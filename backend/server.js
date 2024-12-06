// server/server.js
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

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/live-polling-system', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Mongoose Models
const PollSchema = new mongoose.Schema({
  question: String,
  options: [String],
  createdAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  responses: [{
    studentId: String,
    answer: String,
    answeredAt: Date
  }],
  maxTime: { type: Number, default: 60 }
});

const Poll = mongoose.model('Poll', PollSchema);

const StudentSchema = new mongoose.Schema({
  name: String,
  socketId: String,
  createdAt: { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', StudentSchema);

// Socket.io Logic
io.on('connection', (socket) => {
  console.log('New client connected');

  // Student Registration
  socket.on('register_student', async (studentName) => {
    try {
      // Check if student name is unique
      const existingStudent = await Student.findOne({ name: studentName });
      if (existingStudent) {
        socket.emit('student_registration_error', 'Name already exists');
        return;
      }

      const newStudent = new Student({
        name: studentName,
        socketId: socket.id
      });
      await newStudent.save();

      socket.emit('student_registered', { 
        id: newStudent._id, 
        name: newStudent.name 
      });
    } catch (error) {
      socket.emit('student_registration_error', error.message);
    }
  });

  // Teacher Creates Poll
  socket.on('create_poll', async (pollData) => {
    try {
      // Check if there's an active poll
      const activePoll = await Poll.findOne({ active: true });
      if (activePoll) {
        socket.emit('poll_creation_error', 'An active poll already exists');
        return;
      }

      const newPoll = new Poll({
        question: pollData.question,
        options: pollData.options,
        maxTime: pollData.maxTime || 60
      });
      await newPoll.save();

      // Broadcast poll to all students
      io.emit('new_poll', {
        id: newPoll._id,
        question: newPoll.question,
        options: newPoll.options,
        maxTime: newPoll.maxTime
      });
    } catch (error) {
      socket.emit('poll_creation_error', error.message);
    }
  });

  // Student Submits Answer
  socket.on('submit_answer', async (answerData) => {
    try {
      const activePoll = await Poll.findOne({ active: true });
      if (!activePoll) {
        socket.emit('answer_error', 'No active poll');
        return;
      }

      // Check if student has already answered
      const existingResponse = activePoll.responses.find(
        r => r.studentId === answerData.studentId
      );
      if (existingResponse) {
        socket.emit('answer_error', 'You have already answered this poll');
        return;
      }

      activePoll.responses.push({
        studentId: answerData.studentId,
        answer: answerData.answer,
        answeredAt: new Date()
      });

      // If all students have answered, close the poll
      const totalStudents = await Student.countDocuments();
      if (activePoll.responses.length >= totalStudents) {
        activePoll.active = false;
      }

      await activePoll.save();

      // Broadcast updated poll results
      io.emit('poll_results', {
        pollId: activePoll._id,
        responses: activePoll.responses
      });
    } catch (error) {
      socket.emit('answer_error', error.message);
    }
  });

  // Get Current Active Poll
  socket.on('get_active_poll', async () => {
    try {
      const activePoll = await Poll.findOne({ active: true });
      if (activePoll) {
        socket.emit('active_poll', {
          id: activePoll._id,
          question: activePoll.question,
          options: activePoll.options,
          maxTime: activePoll.maxTime
        });
      } else {
        socket.emit('no_active_poll');
      }
    } catch (error) {
      socket.emit('poll_fetch_error', error.message);
    }
  });

  // Fetch Past Polls
  socket.on('get_past_polls', async () => {
    try {
      const pastPolls = await Poll.find({ active: false })
        .sort({ createdAt: -1 })
        .limit(10);
      
      socket.emit('past_polls', pastPolls);
    } catch (error) {
      socket.emit('past_polls_error', error.message);
    }
  });

  socket.on('disconnect', async () => {
    // Remove student from database on disconnect
    await Student.findOneAndDelete({ socketId: socket.id });
    console.log('Client disconnected');
  });
});

// Server Routes (optional, for REST API support)
app.get('/api/polls', async (req, res) => {
  try {
    const polls = await Poll.find().sort({ createdAt: -1 });
    res.json(polls);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io, server };