const { rooms, users } = require('../state');
const words = require('../utils/words.json');

module.exports = (io, socket, redisClient) => {
    
    socket.on('join-room', async ({ roomId, username }) => {
        socket.join(roomId);
        users[socket.id] = username || 'Anonymous';
        console.log(`User ${users[socket.id]} joined room ${roomId}`);

        if (!rooms[roomId]) {
            rooms[roomId] = { 
                players: [], 
                drawerIndex: 0, 
                isPlaying: false, 
                endTime: null, 
                timeoutId: null, 
                scores: {}, 
                roundStartTime: null,
                hintTimeouts: []
            };
            // AI Bot initialization
            rooms[roomId].scores['ai_bot'] = { username: '🤖 AI Bot', score: 0 };
        }
        
        rooms[roomId].players.push(socket.id);
        if (!rooms[roomId].scores[socket.id]) {
            rooms[roomId].scores[socket.id] = { username: users[socket.id], score: 0 };
        }

        io.to(roomId).emit('score-update', rooms[roomId].scores);

        if (rooms[roomId].isPlaying) {
            const remainingTime = Math.max(0, rooms[roomId].endTime - Date.now());
            socket.emit('game-started', { role: 'guesser', word: null, remainingTime });
        }

        // Load History
        const history = await redisClient.lRange(`room:${roomId}:history`, 0, -1);
        if (history.length > 0) {
            socket.emit('load-history', history.map(item => JSON.parse(item)));
        }
    });

    socket.on('start-game', (roomId) => {
        const room = rooms[roomId];
        if (!room || room.players.length === 0) {
            socket.emit('error-msg', 'No players in room!');
            return;
        }
        if (room.isPlaying) return;

        // Pick word
        const wordEntry = words[Math.floor(Math.random() * words.length)];
        const word = typeof wordEntry === 'string' ? wordEntry : wordEntry.word;
        
        const drawerId = room.players[room.drawerIndex % room.players.length];
        room.drawerIndex++;
        room.currentWord = word;
        room.drawerId = drawerId;
        room.correctGuessers = [];
        room.isPlaying = true;
        room.roundStartTime = Date.now();
        room.endTime = Date.now() + 60000;

        // Clear canvas
        redisClient.del(`room:${roomId}:history`);
        io.to(roomId).emit('clear-canvas');

        // Setup hints
        setupHints(io, roomId, room, word);

        // Round timeout
        if (room.timeoutId) clearTimeout(room.timeoutId);
        room.timeoutId = setTimeout(() => {
            if (!room.isPlaying) return;
            room.isPlaying = false;
            room.currentWord = null;
            clearHintTimeouts(room);
            io.to(roomId).emit('round-over', { reason: 'timeout' });
        }, 60000);

        // Notify players
        room.players.forEach((playerId) => {
            const role = playerId === drawerId ? 'drawer' : 'guesser';
            const sentWord = role === 'drawer' ? word : room.hintArray.join(' ');
            io.to(playerId).emit('game-started', { role, word: sentWord, remainingTime: 60000 });
        });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
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
};

function setupHints(io, roomId, room, word) {
    room.hintArray = Array(word.length).fill('_');
    for (let i = 0; i < word.length; i++) {
        if (word[i] === ' ') room.hintArray[i] = ' ';
    }

    // Reveal 1 random
    const unrevealed = room.hintArray.map((c, i) => c === '_' ? i : -1).filter(i => i !== -1);
    if (unrevealed.length > 0) {
        const idx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        room.hintArray[idx] = word[idx];
    }

    clearHintTimeouts(room);

    const hintsToReveal = Math.max(0, Math.floor(word.length / 2) - 1);
    if (hintsToReveal > 0) {
        const interval = 60000 / (hintsToReveal + 1);
        for (let i = 1; i <= hintsToReveal; i++) {
            const timeout = setTimeout(() => {
                if (!room.isPlaying) return;
                const remain = room.hintArray.map((c, i) => c === '_' ? i : -1).filter(i => i !== -1);
                if (remain.length > 0) {
                    const rIdx = remain[Math.floor(Math.random() * remain.length)];
                    room.hintArray[rIdx] = word[rIdx];
                    io.to(roomId).emit('word-hint-update', room.hintArray.join(' '));
                }
            }, interval * i);
            room.hintTimeouts.push(timeout);
        }
    }
}

function clearHintTimeouts(room) {
    if (room.hintTimeouts) {
        room.hintTimeouts.forEach(t => clearTimeout(t));
        room.hintTimeouts = [];
    }
}
