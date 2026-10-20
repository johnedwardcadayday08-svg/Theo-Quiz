const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let isGameStarted = false;
let timerInterval = null;
let groupScores = { 'Soul 1': 0, 'Soul 2': 0, 'Soul 3': 0, 'Soul 4': 0 };
let groupTimers = { 'Soul 1': 90, 'Soul 2': 90, 'Soul 3': 90, 'Soul 4': 90 };
let attorneyPhotos = { 'Soul 1': '', 'Soul 2': '', 'Soul 3': '', 'Soul 4': '' };
let groupCompletedStatus = { 'Soul 1': false, 'Soul 2': false, 'Soul 3': false, 'Soul 4': false };
let popupQueue = [];

const correctAnswers = {
    q1: 'B', // Israel
    q2: 'B', // Greece
    q3: 'A', // Augustine
    q4: 'C', // St. Patrick
    q5: 'A', // Top-down ruler conversions
    q6: 'B', // Franciscans
    q7: 'C', // William Carey
    q8: 'A', // Hudson Taylor
    q9: 'C', // Global South
    q10: 'B' // Polycentrism
};

io.on('connection', (socket) => {
    socket.emit('gameState', { isGameStarted });
    socket.emit('updateState', { groupScores, photos: attorneyPhotos, completedStatus: groupCompletedStatus });
    socket.emit('timerUpdate', groupTimers);

    socket.on('registerAttorneyPhoto', ({ groupName, photo }) => {
        if (groupName && photo) {
            attorneyPhotos[groupName] = photo;
            popupQueue.push({ groupName, photo });
            io.emit('updateState', { groupScores, photos: attorneyPhotos, completedStatus: groupCompletedStatus });
        }
    });

    socket.on('startTimer', () => {
        if (!isGameStarted) {
            isGameStarted = true;
            groupTimers = { 'Soul 1': 90, 'Soul 2': 90, 'Soul 3': 90, 'Soul 4': 90 };
            groupCompletedStatus = { 'Soul 1': false, 'Soul 2': false, 'Soul 3': false, 'Soul 4': false };
            
            io.emit('gameState', { isGameStarted });
            io.emit('timerUpdate', groupTimers);
            io.emit('updateState', { groupScores, photos: attorneyPhotos, completedStatus: groupCompletedStatus });

            if (timerInterval) clearInterval(timerInterval);

            timerInterval = setInterval(() => {
                let allZero = true;
                Object.keys(groupTimers).forEach(group => {
                    if (groupTimers[group] > 0) {
                        groupTimers[group] -= 1;
                        allZero = false;
                    }
                });
                io.emit('timerUpdate', groupTimers);

                if (allZero) {
                    clearInterval(timerInterval);
                    isGameStarted = false;
                    io.emit('timeUp');
                }
            }, 1000);
        }
    });

    socket.on('forceTimeUp', () => {
        if (timerInterval) clearInterval(timerInterval);
        isGameStarted = false;
        io.emit('timeUp');
    });

    socket.on('submitAnswer', ({ groupName, questionId, answer, answeredCount }) => {
        if (!isGameStarted) return;
        const isCorrect = (answer === correctAnswers[questionId]);

        if (isCorrect) {
            groupScores[groupName] = (groupScores[groupName] || 0) + 1;
            groupTimers[groupName] = (groupTimers[groupName] || 90) + 5; // +5 seconds bonus time
        }

        if (answeredCount >= 10) {
            groupCompletedStatus[groupName] = true;
            io.emit('groupFinished', { groupName });
        }

        socket.emit('answerFeedback', { isCorrect, questionId, answer });
        io.emit('updateState', { groupScores, photos: attorneyPhotos, completedStatus: groupCompletedStatus });
        io.emit('timerUpdate', groupTimers);
    });

    socket.on('resetGame', () => {
        if (timerInterval) clearInterval(timerInterval);
        isGameStarted = false;
        groupScores = { 'Soul 1': 0, 'Soul 2': 0, 'Soul 3': 0, 'Soul 4': 0 };
        groupTimers = { 'Soul 1': 90, 'Soul 2': 90, 'Soul 3': 90, 'Soul 4': 90 };
        groupCompletedStatus = { 'Soul 1': false, 'Soul 2': false, 'Soul 3': false, 'Soul 4': false };
        attorneyPhotos = { 'Soul 1': '', 'Soul 2': '', 'Soul 3': '', 'Soul 4': '' };
        popupQueue = [];

        io.emit('gameState', { isGameStarted });
        io.emit('timerUpdate', groupTimers);
        io.emit('updateState', { groupScores, photos: attorneyPhotos, completedStatus: groupCompletedStatus });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});