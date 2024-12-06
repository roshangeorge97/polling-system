const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const uri = "mongodb+srv://roshangeorge2003:123@cluster0.tuypt.mongodb.net/live-polling-system?retryWrites=true&w=majority&appName=Cluster0";

// Mongoose Connection
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const MessageSchema = new mongoose.Schema({
    sender: String,
    content: String,
    timestamp: { type: Date, default: Date.now }
  });
  
  const PollSchema = new mongoose.Schema({
    question: String,
    options: [String],
    responses: [{
      studentId: String,
      answer: String,
      timestamp: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    maxTime: Number,
    status: { type: String, default: 'active' }
  });
  
  const Poll = mongoose.model('Poll', PollSchema);
  const Message = mongoose.model('Message', MessageSchema);
  
  const activeState = {
    activePoll: null,
    students: new Map(), // Changed to Map to store socket IDs
    messages: []
  };
  

  io.on('connection', (socket) => {
    socket.on('register_student', async (name) => {
      if (!name) {
        socket.emit('student_registration_error', 'Name is required');
        return;
      }
  
      if (Array.from(activeState.students.values()).includes(name)) {
        socket.emit('student_registration_error', 'This name is already in use');
        return;
      }
  
      activeState.students.set(socket.id, name);
      socket.studentName = name;
      socket.emit('student_registered');
      io.emit('student_list_update', Array.from(activeState.students.values()));
    });
  
    socket.on('kick_student', (studentName) => {
      const studentSocketId = Array.from(activeState.students.entries())
        .find(([_, name]) => name === studentName)?.[0];
      
      if (studentSocketId) {
        io.to(studentSocketId).emit('kicked');
        activeState.students.delete(studentSocketId);
        io.emit('student_list_update', Array.from(activeState.students.values()));
      }
    });
  
    socket.on('send_message', async (message) => {
      const newMessage = new Message({
        sender: message.sender,
        content: message.content
      });
      await newMessage.save();
      activeState.messages.push(newMessage);
      io.emit('new_message', newMessage);
    });
  
    socket.on('get_messages', async () => {
      const messages = await Message.find().sort({ timestamp: -1 }).limit(50);
      socket.emit('message_history', messages.reverse());
    });

  // Create Poll (Teacher)
  socket.on('create_poll', async (pollData) => {
    // Check if there's an active poll
    if (activeState.activePoll) {
      socket.emit('poll_creation_error', 'A poll is already active');
      return;
    }

    try {
      // Create new poll in database
      const newPoll = new Poll({
        question: pollData.question,
        options: pollData.options,
        maxTime: pollData.maxTime || 60,
      });
      await newPoll.save();

      // Set as active poll
      activeState.activePoll = newPoll;

      // Broadcast new poll to all students
      io.emit('new_poll', {
        _id: newPoll._id,
        question: newPoll.question,
        options: newPoll.options,
        maxTime: newPoll.maxTime
      });
    } catch (error) {
      socket.emit('poll_creation_error', 'Failed to create poll');
    }
  });

  // Submit Answer
  socket.on('submit_answer', async (answerData) => {
    if (!activeState.activePoll) return;

    try {
      // Find and update the poll
      const poll = await Poll.findById(activeState.activePoll._id);
      
      // Check for existing response
      const existingResponseIndex = poll.responses.findIndex(
        r => r.studentId === answerData.studentId
      );

      if (existingResponseIndex !== -1) {
        // Update existing response
        poll.responses[existingResponseIndex] = {
          studentId: answerData.studentId,
          answer: answerData.answer,
          timestamp: new Date()
        };
      } else {
        // Add new response
        poll.responses.push({
          studentId: answerData.studentId,
          answer: answerData.answer,
          timestamp: new Date()
        });
      }

      await poll.save();

      // Calculate and send live results
      const results = poll.options.map(option => ({
        option,
        count: poll.responses.filter(r => r.answer === option).length
      }));

      // Broadcast live results to all students
      io.emit('poll_results', results);

      // Check if all students have responded
      if (poll.responses.length === activeState.students.size) {
        // Mark poll as completed
        poll.status = 'completed';
        await poll.save();

        // Reset active poll
        io.emit('poll_closed');
        activeState.activePoll = null;
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  });

  // Get Active Poll
  socket.on('get_active_poll', async () => {
    try {
      if (activeState.activePoll && activeState.activePoll._id) {
        const poll = await Poll.findById(activeState.activePoll._id);
        if (poll) {
          socket.emit('active_poll', {
            _id: poll._id,
            question: poll.question,
            options: poll.options,
            maxTime: poll.maxTime,
            responses: poll.responses
          });
        } else {
          activeState.activePoll = null;
          socket.emit('no_active_poll');
        }
      } else {
        socket.emit('no_active_poll');
      }
    } catch (error) {
      console.error('Error fetching active poll:', error);
      socket.emit('no_active_poll');
    }
  });

  socket.on('get_poll_responses', async (pollId) => {
    try {
      const poll = await Poll.findById(pollId);
      if (poll) {
        socket.emit('poll_response_update', {
          _id: poll._id,
          responses: poll.responses
        });
      }
    } catch (error) {
      console.error('Error fetching poll responses:', error);
    }
  });

  // Get Past Polls
  socket.on('get_past_polls', async () => {
    try {
      const pastPolls = await Poll.find({ status: 'completed' }).sort({ createdAt: -1 });
      socket.emit('past_polls', pastPolls);
    } catch (error) {
      console.error('Error fetching past polls:', error);
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    if (activeState.students.has(socket.id)) {
      activeState.students.delete(socket.id);
      io.emit('student_list_update', Array.from(activeState.students.values()));
    }
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});