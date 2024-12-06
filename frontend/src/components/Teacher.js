import React, { useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

const Teacher = () => {
    const [question, setQuestion] = useState('');

    const createPoll = () => {
        socket.emit('newPoll', { question });
        setQuestion('');
    };

    return (
        <div>
            <h2>Teacher Panel</h2>
            <input
                type="text"
                placeholder="Enter your question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
            />
            <button onClick={createPoll}>Start Poll</button>
        </div>
    );
};

export default Teacher;
