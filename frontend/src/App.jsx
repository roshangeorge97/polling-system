import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';
import { MessageCircle, X } from 'lucide-react';

// Socket Connection
const socket = io('https://polling-system-1tfn.onrender.com');

// Main App Component
function App() {
  const [userType, setUserType] = useState(null);

  return (
    <div className="app-container">
      {!userType ? (
        <div className="login-container">
          <h2 className="gradient-title">Live Polling System</h2>
          <button
            onClick={() => setUserType('teacher')}
            className="login-button teacher-button"
          >
            Teacher Login
          </button>
          <button
            onClick={() => setUserType('student')}
            className="login-button student-button"
          >
            Student Login
          </button>
        </div>
      ) : userType === 'teacher' ? (
        <TeacherDashboard socket={socket} />
      ) : (
        <StudentDashboard socket={socket} />
      )}
    </div>
  );
}

// Teacher Dashboard Component
function TeacherDashboard({ socket }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [maxTime, setMaxTime] = useState(60);
  const [activePoll, setActivePoll] = useState(null);
  const [pastPolls, setPastPolls] = useState([]);
  const [pollError, setPollError] = useState(null);
  const [statsVisible, setStatsVisible] = useState(null);
  const [students, setStudents] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    socket.emit('get_past_polls');
    socket.emit('get_active_poll');

    socket.on('student_list_update', (studentList) => {
      setStudents(studentList);
    });

    socket.on('new_poll', (poll) => {
      setActivePoll(poll);
    });

    socket.on('poll_response_update', (updatedPoll) => {
      setActivePoll(prev => ({
        ...prev,
        responses: updatedPoll.responses
      }));
    });

    socket.on('past_polls', (polls) => {
      setPastPolls(polls);
    });

    socket.on('active_poll', (poll) => {
      setActivePoll(poll);
    });


    socket.on('no_active_poll', () => {
      setActivePoll(null);
    });

    socket.on('poll_creation_error', (error) => {
      setPollError(error);
      setTimeout(() => setPollError(null), 3000);
    });

    socket.on('poll_closed', () => {
      setActivePoll(null);
      socket.emit('get_past_polls');
    });

    return () => {
      socket.off('new_poll');
      socket.off('past_polls');
      socket.off('active_poll');
      socket.off('no_active_poll');
      socket.off('poll_creation_error');
      socket.off('poll_closed');
      socket.off('student_list_update');
    };
  }, [socket]);

  const kickStudent = (studentName) => {
    socket.emit('kick_student', studentName);
  };

  const toggleStatsVisibility = (pollId) => {
    if (statsVisible === pollId) {
      setStatsVisible(null);
    } else {
      setStatsVisible(pollId);
      if (activePoll && activePoll._id === pollId) {
        socket.emit('get_poll_responses', pollId);
      }
    }
  };

  const createPoll = () => {
    if (!question || options.some(opt => !opt.trim())) {
      alert('Please fill in all fields');
      return;
    }

    socket.emit('create_poll', {
      question,
      options: options.filter(opt => opt.trim()),
      maxTime,
    });

    // Reset form
    setQuestion('');
    setOptions(['', '']);
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  return (
    <div className="container">
      <h2 className="gradient-title">Teacher Dashboard</h2>
      <div className="student-list bg-white p-4 rounded-lg shadow mb-6">
        <h3 className="text-lg font-semibold mb-3">Connected Students</h3>
        <div className="space-y-2">
          {students.map((student, index) => (
            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <span>{student}</span>
              <button
                onClick={() => kickStudent(student)}
                className="text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      
      {pollError && (
        <div className="bg-red-100 text-red-800 p-3 rounded-lg mb-4 text-center">
          {pollError}
        </div>
      )}

      <div className="space-y-6">
        <input
          placeholder="Enter your poll question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={!!activePoll}
          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {options.map((option, index) => (
          <input
            key={index}
            placeholder={`Option ${index + 1}`}
            value={option}
            onChange={(e) => updateOption(index, e.target.value)}
            disabled={!!activePoll}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ))}

        <button
          onClick={addOption}
          disabled={!!activePoll}
          className="w-full p-3 border rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
        >
          Add Option
        </button>

        <div className="flex items-center space-x-4">
          <label className="text-lg">Max Time (seconds):</label>
          <input
            type="number"
            value={maxTime}
            onChange={(e) => setMaxTime(Number(e.target.value))}
            className="w-24 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!!activePoll}
            min="10"
            max="300"
          />
        </div>

        <button
          onClick={createPoll}
          disabled={!!activePoll}
          className="w-full p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          Create Poll
        </button>

        {activePoll && (
        <div className="mt-6 p-4 bg-blue-100 rounded-lg shadow-md">
          <h3 className="font-semibold text-lg text-blue-600">Current Poll</h3>
          <p className="text-gray-800 font-medium mb-2">{activePoll.question}</p>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => toggleStatsVisibility(activePoll._id)}
          >
            {statsVisible === activePoll._id ? 'Hide Stats' : 'View Stats'}
          </button>
          {statsVisible === activePoll._id && activePoll.responses && (
            <div className="mt-4 bg-white p-3 rounded-lg shadow-sm">
              <p className="text-gray-700">Responses:</p>
              <ul className="list-disc pl-5">
                {activePoll.responses.map((response, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    {response.studentId}: {response.answer}
                  </li>
                ))}
              </ul>
              <p className="text-gray-700 mt-3">
                Total Responses: {activePoll.responses.length}
              </p>
            </div>
          )}
        </div>
      )}


<div className="past-polls-container">
        <h3>Past Polls</h3>
        {pastPolls.map((poll) => (
          <div key={poll._id} className="past-poll-card">
            <div 
              className="past-poll-header"
              onClick={() => toggleStatsVisibility(poll._id)}
            >
              <h4>{poll.question}</h4>
              <span className={`chevron-icon ${statsVisible === poll._id ? 'expanded' : ''}`}>
                ▼
              </span>
            </div>
            
            {statsVisible === poll._id && (
              <div className="past-poll-content">
                {poll.responses.map((response, index) => (
                  <div key={index} className="past-poll-response">
                    <span className="response-name">{response.studentId}:</span>
                    <span className="response-answer">{response.answer}</span>
                  </div>
                ))}
                <div className="response-total">
                  Total Responses: {poll.responses.length}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
    <ChatPopup socket={socket} isTeacher={true} userName="Teacher" isOpen={chatOpen} setIsOpen={setChatOpen} />
    </div>
  );
}

// Student Dashboard Component
function StudentDashboard({ socket }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [activePoll, setActivePoll] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [pollResults, setPollResults] = useState(null);
  const [registrationError, setRegistrationError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const storedName = sessionStorage.getItem('studentName');
    if (storedName) {
      setStudentName(storedName);
      registerStudent(storedName);
    }

    socket.on('kicked', () => {
      sessionStorage.removeItem('studentName');
      window.location.reload();
    });

    // Student registration events
    socket.on('student_registered', () => {
      setIsRegistered(true);
      setRegistrationError(null);
      // Immediately try to fetch the active poll
      socket.emit('get_active_poll');
    });

    socket.on('student_registration_error', (error) => {
      setRegistrationError(error);
      setTimeout(() => setRegistrationError(null), 3000);
    });

    // Active poll events
    socket.on('new_poll', (poll) => {
      
      setActivePoll(poll);
      setTimeRemaining(poll.maxTime);
      setPollResults(null);
      setSelectedAnswer('');

      // Start countdown timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            socket.emit('get_active_poll');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('no_active_poll', () => {
      setActivePoll(null);
      setPollResults(null);
    });

    socket.on('poll_results', (results) => {
      setPollResults(results);
      clearInterval(timerRef.current);
    });

    return () => {
      socket.off('kicked');
      socket.off('student_registered');
      socket.off('student_registration_error');
      socket.off('new_poll');
      socket.off('no_active_poll');
      socket.off('poll_results');
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [socket]);

  const registerStudent = (name) => {
    socket.emit('register_student', name);
    sessionStorage.setItem('studentName', name);
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (studentName.trim()) {
      registerStudent(studentName);
    }
  };

  const submitAnswer = () => {
    if (!selectedAnswer) {
      alert('Please select an answer');
      return;
    }

    socket.emit('submit_answer', {
      studentId: studentName,
      answer: selectedAnswer,
    });
  };

  if (!isRegistered) {
    return (
      <div className="bg-white shadow-lg rounded-lg p-6 w-[350px] max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-center text-blue-600">Student Registration</h2>
        {registrationError && (
          <div className="bg-red-100 text-red-800 p-3 rounded-lg mb-4 text-center">
            {registrationError}
          </div>
        )}
        <form onSubmit={handleNameSubmit} className="space-y-4">
          <input
            placeholder="Enter your name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            required
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition-colors"
          >
            Register
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 w-full sm:w-[500px] max-w-xl">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-600">Student Dashboard</h2>
      <p className="mb-4 text-gray-600 text-center">Welcome, {studentName}</p>

      {activePoll ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{activePoll.question}</h3>
          <div className="space-y-2">
            {activePoll.options.map((option, index) => (
              <button
                key={index}
                onClick={() => setSelectedAnswer(option)}
                className={`w-full p-3 rounded-lg text-white ${
                  selectedAnswer === option ? 'bg-blue-600' : 'bg-blue-500'
                } hover:bg-blue-600 focus:outline-none transition-colors`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">Time Remaining: {timeRemaining} seconds</span>
            <button
              onClick={submitAnswer}
              className="p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Submit Answer
            </button>
          </div>
        </div>
      ) : (
        <p className="text-center text-lg text-gray-600">No active poll at the moment.</p>
      )}

      {pollResults && (
        <div className="mt-6 bg-yellow-100 p-4 rounded-lg">
          <h3 className="font-semibold">Poll Results</h3>
          {pollResults.map((result, index) => (
            <div key={index} className="text-sm text-gray-700">
              {result.option}: {result.count} votes
            </div>
          ))}
        </div>
      )}
            <ChatPopup
        socket={socket}
        isTeacher={false}
        userName={studentName}
        isOpen={chatOpen}
        setIsOpen={setChatOpen}
      />
    </div>
  );
}

function ChatPopup({ socket, isTeacher, userName, isOpen, setIsOpen }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.emit('get_messages');
    
    socket.on('message_history', (history) => {
      setMessages(history);
    });

    socket.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      socket.off('message_history');
      socket.off('new_message');
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      socket.emit('send_message', {
        sender: userName,
        content: newMessage
      });
      setNewMessage('');
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-blue-500 text-white rounded-full shadow-lg"
      >
        <MessageCircle size={24} />
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-4 w-80 bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center p-3 border-b">
            <h3 className="font-semibold">Chat</h3>
            <button onClick={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="h-96 overflow-y-auto p-3">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-2 ${msg.sender === userName ? 'text-right' : ''}`}
              >
                <span className="text-xs text-gray-500">{msg.sender}</span>
                <div className={`p-2 rounded-lg inline-block max-w-[80%] ${
                  msg.sender === userName
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-3 border-t">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="w-full p-2 border rounded-lg"
            />
          </form>
        </div>
      )}
    </>
  );
}

export default App;