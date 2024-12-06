import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

const Student = () => {
    const [name, setName] = useState(localStorage.getItem('studentName') || '');
    const [answer, setAnswer] = useState('');
    const [poll, setPoll] = useState(null);
    const [results, setResults] = useState({});

    useEffect(() => {
        socket.on('pollCreated', (pollData) => {
            setPoll(pollData);
        });

        socket.on('pollResults', (pollResults) => {
            setResults(pollResults);
        });

        return () => socket.off();
    }, []);

    const submitAnswer = () => {
        socket.emit('submitAnswer', { studentName: name, answer });
    };

    if (!name) {
        return (
            <div>
                <input
                    type="text"
                    placeholder="Enter your name"
                    onChange={(e) => setName(e.target.value)}
                />
                <button onClick={() => localStorage.setItem('studentName', name)}>Submit</button>
            </div>
        );
    }

    return (
        <div>
            <h2>Student Panel</h2>
            {poll ? (
                <div>
                    <p>Question: {poll.question}</p>
                    <input
                        type="text"
                        placeholder="Your answer"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                    />
                    <button onClick={submitAnswer}>Submit</button>
                </div>
            ) : (
                <p>No active poll</p>
            )}
            <h3>Results:</h3>
            <pre>{JSON.stringify(results, null, 2)}</pre>
        </div>
    );
};

export default Student;
