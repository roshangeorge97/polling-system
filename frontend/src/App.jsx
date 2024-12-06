import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

// Socket Connection
const socket = io('http://localhost:5000');

// Main App Component
function App() {
  const [userType, setUserType] = useState(null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      {!userType ? (
        <div className="bg-white shadow-lg rounded-lg p-6 w-full sm:w-[350px] max-w-md">
          <h2 className="text-2xl font-bold mb-4 text-center text-blue-600">Live Polling System</h2>
          <div className="grid gap-4">
            <button
              onClick={() => setUserType('teacher')}
              className="bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors focus:outline-none"
            >
              Teacher Login
            </button>
            <button
              onClick={() => setUserType('student')}
              className="bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition-colors focus:outline-none"
            >
              Student Login
            </button>
          </div>
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

  useEffect(() => {
    socket.emit('get_past_polls');
    socket.on('past_polls', (polls) => {
      setPastPolls(polls);
    });

    socket.emit('get_active_poll');
    socket.on('active_poll', (poll) => {
      setActivePoll(poll);
    });

    return () => {
      socket.off('past_polls');
      socket.off('active_poll');
    };
  }, []);

  const createPoll = () => {
    if (!question || options.some(opt => !opt)) {
      alert('Please fill in all fields');
      return;
    }

    socket.emit('create_poll', {
      question,
      options,
      maxTime,
    });

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
    <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-3xl">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-600">Teacher Dashboard</h2>
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
          <div className="mt-6 p-4 bg-yellow-100 rounded-lg">
            <h3 className="font-semibold">Active Poll</h3>
            <p>{activePoll.question}</p>
            <p>Time Remaining: {activePoll.maxTime} seconds</p>
          </div>
        )}

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Past Polls</h3>
          {pastPolls.map((poll) => (
            <div key={poll._id} className="bg-white shadow-lg rounded-lg p-4 mb-4">
              <p className="font-medium">{poll.question}</p>
              <div>
                {poll.responses.map((response) => (
                  <div key={response._id} className="text-sm text-gray-600">
                    {response.answer}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Student Dashboard Component
function StudentDashboard({ socket }) {
  const [studentName, setStudentName] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [activePoll, setActivePoll] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [pollResults, setPollResults] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const storedName = sessionStorage.getItem('studentName');
    if (storedName) {
      setStudentName(storedName);
      setIsRegistered(true);
      registerStudent(storedName);
    }

    socket.on('student_registered', () => {
      setIsRegistered(true);
    });

    socket.on('new_poll', (poll) => {
      setActivePoll(poll);
      setTimeRemaining(poll.maxTime);
      setPollResults(null);

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

    socket.on('poll_results', (results) => {
      setPollResults(results);
      clearInterval(timerRef.current);
    });

    return () => {
      socket.off('student_registered');
      socket.off('new_poll');
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
    </div>
  );
}

export default App;
