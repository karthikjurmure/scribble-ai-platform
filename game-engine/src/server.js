require('dotenv').config({ path: require('path').join(__dirname, '../../game-engine/.env') });
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const words = require('./utils/words.json');

const app = express();
const server = http.createServer(app);

// ── Redis ──────────────────────────────────────────────────────────────────
const redisClient = createClient({
    url: process.env.REDIS_URL
});
redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect().then(() => {
    console.log('🚀 Connected to Redis Cloud');
});

// ── Static files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// ── Socket.IO ──────────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: { origin: '*' }
});

// In-memory room state: { [roomId]: { players: [socketId], drawerIndex: 0, isPlaying: false, endTime: null, timeoutId: null } }
const rooms = {};
// Map socketId to username
const users = {};

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on('join-room', async ({ roomId, username }) => {
        socket.join(roomId);
        users[socket.id] = username || 'Anonymous';
        console.log(`User ${users[socket.id]} (${socket.id}) joined room ${roomId}`);

        // Track players in room
        if (!rooms[roomId]) {
            rooms[roomId] = { players: [], drawerIndex: 0, isPlaying: false, endTime: null, timeoutId: null, scores: {}, roundStartTime: null };
        }
        rooms[roomId].players.push(socket.id);
        if (!rooms[roomId].scores[socket.id]) {
            rooms[roomId].scores[socket.id] = { username: users[socket.id], score: 0 };
        }

        io.to(roomId).emit('score-update', rooms[roomId].scores);

        // If a game is already in progress, join as guesser
        if (rooms[roomId].isPlaying) {
            const remainingTime = Math.max(0, rooms[roomId].endTime - Date.now());
            socket.emit('game-started', { role: 'guesser', word: null, remainingTime });
        }

        // Send existing canvas history to the newly joined user
        const history = await redisClient.lRange(`room:${roomId}:history`, 0, -1);
        if (history.length > 0) {
            const parsedHistory = history.map(item => JSON.parse(item));
            socket.emit('load-history', parsedHistory);
        }
    });

    // ── Game start ────────────────────────────────────────────────────────
    socket.on('start-game', (roomId) => {
        const room = rooms[roomId];
        if (!room || room.players.length === 0) {
            socket.emit('error-msg', 'No players in room!');
            return;
        }
        if (room.isPlaying) {
            socket.emit('error-msg', 'Game is already in progress!');
            return;
        }

        // Pick a random word (handle both string array and {word, difficulty} object array formats)
        const wordEntry = words[Math.floor(Math.random() * words.length)];
        const word = typeof wordEntry === 'string' ? wordEntry : wordEntry.word;

        // Pick drawer (rotate each round)
        const drawerIndex = room.drawerIndex % room.players.length;
        const drawerId = room.players[drawerIndex];
        room.drawerIndex++;
        room.currentWord = word;
        room.drawerId = drawerId;

        console.log(`Room ${roomId}: drawer=${drawerId}, word=${word}`);

        // Clear canvas for fresh round
        redisClient.del(`room:${roomId}:history`);
        io.to(roomId).emit('clear-canvas');

        room.correctGuessers = []; // Track who has guessed correctly

        // Set game state and timer
        room.isPlaying = true;
        room.roundStartTime = Date.now();
        room.endTime = Date.now() + 60000; // 60 seconds
        if (room.timeoutId) clearTimeout(room.timeoutId);
        room.timeoutId = setTimeout(() => {
            room.isPlaying = false;
            room.currentWord = null;
            io.to(roomId).emit('round-over', { reason: 'timeout' });
        }, 60000);

        const remainingTime = 60000;

        // Tell every player their role
        room.players.forEach((playerId) => {
            const role = playerId === drawerId ? 'drawer' : 'guesser';
            // Only the drawer sees the word
            const sentWord = role === 'drawer' ? word : null;
            io.to(playerId).emit('game-started', { role, word: sentWord, remainingTime });
        });
    });

    // ── Chat & Guess checking ─────────────────────────────────────────────
    socket.on('chat-message', ({ roomId, message }) => {
        const room = rooms[roomId];
        const username = users[socket.id] || 'Anonymous';

        if (room && room.isPlaying && room.currentWord) {
            const isGuesserCorrect = room.correctGuessers.includes(socket.id);
            const isDrawer = (room.drawerId === socket.id);
            const isWordMatch = message.trim().toLowerCase() === room.currentWord.toLowerCase();

            if (!isGuesserCorrect && !isDrawer && isWordMatch) {
                // Correct guess! Calculate score
                room.correctGuessers.push(socket.id);
                const elapsedSeconds = (Date.now() - room.roundStartTime) / 1000;
                let points = 20;
                if (elapsedSeconds <= 10) points = 100;
                else if (elapsedSeconds <= 20) points = 80;
                else if (elapsedSeconds <= 30) points = 50;

                // Add points to guesser
                if (room.scores[socket.id]) room.scores[socket.id].score += points;
                // Add points to drawer ONLY on the first correct guess
                if (room.correctGuessers.length === 1 && room.scores[room.drawerId]) {
                    room.scores[room.drawerId].score += 100;
                }

                io.to(roomId).emit('system-message', `🎉 ${username} guessed the word in ${Math.round(elapsedSeconds)}s and got ${points} pts!`);
                io.to(roomId).emit('score-update', room.scores);

                // Tell this specific user they got it right
                socket.emit('guess-success');

                // Check if everyone (except drawer) has guessed
                if (room.correctGuessers.length >= room.players.length - 1) {
                    room.currentWord = null; // reset until next start
                    room.isPlaying = false;
                    if (room.timeoutId) clearTimeout(room.timeoutId);
                    io.to(roomId).emit('round-over', { reason: 'all-guessed' });
                }
                return;
            } else if ((isGuesserCorrect || isDrawer) && isWordMatch) {
                // Prevent spoiling
                socket.emit('error-msg', 'You cannot send the secret word!');
                return;
            } else {
                // Incorrect guess while playing
                io.to(roomId).emit('chat-message', { sender: username, message, isIncorrectGuess: !isGuesserCorrect && !isDrawer });
                return;
            }
        }

        // Normal chat message
        io.to(roomId).emit('chat-message', { sender: username, message, isIncorrectGuess: false });
    });

    socket.on('draw-data', async ({ roomId, data }) => {
        // Persist stroke to Redis (TTL: 2 hours)
        await redisClient.rPush(`room:${roomId}:history`, JSON.stringify(data));
        await redisClient.expire(`room:${roomId}:history`, 7200);
        socket.to(roomId).emit('draw-data', data);
    });

    socket.on('clear-canvas', async (roomId) => {
        await redisClient.del(`room:${roomId}:history`);
        socket.to(roomId).emit('clear-canvas');
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Remove from all rooms
        for (const roomId in rooms) {
            const room = rooms[roomId];
            room.players = room.players.filter(id => id !== socket.id);
            if (room.scores[socket.id]) {
                delete room.scores[socket.id];
                io.to(roomId).emit('score-update', room.scores);
            }
            if (room.players.length === 0) delete rooms[roomId];
        }
        delete users[socket.id];
    });
});

const port = 3000;
server.listen(port, () => {
    console.log(`server is running on port: ${port}`);
});
