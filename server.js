const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

let isGameStarted = false;
let globalTimer = 90; // 1 minute 30 seconds
let timerInterval = null;

let groupScores = {
    'Soul 1': 0,
    'Soul 2': 0,
    'Soul 3': 0,
    'Soul 4': 0
};

let attorneyPhotos = {
    'Soul 1': '',
    'Soul 2': '',
    'Soul 3': '',
    'Soul 4': ''
};

// Tama at nakatakdang sagot para sa 10 tanong
const correctAnswers = {
    q1: 'B', q2: 'B', q3: 'A', q4: 'C', q5: 'A',
    q6: 'B', q7: 'C', q8: 'A', q9: 'C', q10: 'B'
};

io.on('connection', (socket) => {
    // Ipadala ang kasalukuyang estado ng laro sa bagong konektadong user
    socket.emit('gameState', { isGameStarted });
    socket.emit('updateState', { groupScores, photos: attorneyPhotos });
    socket.emit('timerUpdate', globalTimer);

    // Kapag pumasok at nag-picture ang Soul participant
    socket.on('registerAttorneyPhoto', ({ groupName, photo }) => {
        if (groupName && photo) {
            attorneyPhotos[groupName] = photo;
            io.emit('updateState', { groupScores, photos: attorneyPhotos });
            // I-broadcast sa monitor screen para sa 3-second popup
            io.emit('newParticipantJoined', { groupName, photo });
        }
    });

    // Kapag pinindot ng Teacher / Facilitator ang "Start Quiz"
    socket.on('startTimer', () => {
        if (isGameStarted) return; // Iwasan ang paulit-ulit na pag-start

        isGameStarted = true;
        globalTimer = 90; // I-reset sa 1:30

        io.emit('gameState', { isGameStarted: true });
        io.emit('timerUpdate', globalTimer);

        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (globalTimer > 0) {
                globalTimer--;
                io.emit('timerUpdate', globalTimer);
            } else {
                clearInterval(timerInterval);
                isGameStarted = false;
                io.emit('gameState', { isGameStarted: false });
                io.emit('timeUp');
            }
        }, 1000);
    });

    // Kapag pinindot ang "Time's Up"
    socket.on('forceTimeUp', () => {
        clearInterval(timerInterval);
        globalTimer = 0;
        isGameStarted = false;
        io.emit('timerUpdate', 0);
        io.emit('gameState', { isGameStarted: false });
        io.emit('timeUp');
    });

    // Kapag pinindot ang "Reset"
    socket.on('resetGame', () => {
        clearInterval(timerInterval);
        isGameStarted = false;
        globalTimer = 90;
        groupScores = { 'Soul 1': 0, 'Soul 2': 0, 'Soul 3': 0, 'Soul 4': 0 };
        io.emit('gameState', { isGameStarted: false });
        io.emit('timerUpdate', globalTimer);
        io.emit('updateState', { groupScores, photos: attorneyPhotos });
        io.emit('closeWinnerModal');
    });

    // Kapag nag-submit ng sagot ang participant
    socket.on('submitAnswer', ({ groupName, questionId, answer }) => {
        if (!isGameStarted) return;

        const isCorrect = correctAnswers[questionId] === answer;
        if (isCorrect) {
            groupScores[groupName] = (groupScores[groupName] || 0) + 1;
        }

        socket.emit('answerFeedback', { isCorrect });
        io.emit('updateState', { groupScores, photos: attorneyPhotos });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});