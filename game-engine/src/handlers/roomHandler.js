const { rooms, users } = require('../state');
const { startTurn, nextTurn } = require('../utils/gameLogic');

module.exports = (io, socket, redisClient) => {
    
    socket.on('join-room', async ({ roomId, username }) => {
        socket.join(roomId);
        users[socket.id] = username || 'Anonymous';
        console.log(`User ${users[socket.id]} joined room ${roomId}`);

        if (!rooms[roomId]) {
            rooms[roomId] = { 
                players: [], 
                currentDrawerIndex: 0, 
                gameActive: false, 
                endTime: null, 
                timeoutId: null, 
                roundStartTime: null,
                hintTimeouts: [],
                currentWord: null,
                correctGuessers: []
            };
            // Add AI Bot as a persistent player
            rooms[roomId].players.push({ id: 'ai_bot', username: '🤖 AI Bot', score: 0, isBot: true });
        }
        
        // Add player if not already in
        const existingPlayer = rooms[roomId].players.find(p => p.id === socket.id);
        if (!existingPlayer) {
            rooms[roomId].players.push({ id: socket.id, username: users[socket.id], score: 0 });
        }

        io.to(roomId).emit('score-update', rooms[roomId].players);

        if (rooms[roomId].gameActive) {
            const remainingTime = Math.max(0, rooms[roomId].endTime - Date.now());
            socket.emit('game-started', { role: 'guesser', word: rooms[roomId].hintArray?.join(' '), remainingTime });
        }

        // Load History
        const history = await redisClient.lRange(`room:${roomId}:history`, 0, -1);
        if (history.length > 0) {
            socket.emit('load-history', history.map(item => JSON.parse(item)));
        }
    });

    socket.on('start-game', (roomId) => {
        const room = rooms[roomId];
        if (!room || room.players.length < 2) {
            socket.emit('error-msg', 'Need at least 2 players to start!');
            return;
        }

        // Ensure AI Bot is present (backwards compatibility for existing rooms)
        const hasBot = room.players.some(p => p.id === 'ai_bot');
        if (!hasBot) {
            room.players.push({ id: 'ai_bot', username: '🤖 AI Bot', score: 0, isBot: true });
            io.to(roomId).emit('score-update', room.players);
        }

        if (room.gameActive) return;

        room.gameActive = true;
        room.currentDrawerIndex = 0;
        startTurn(io, roomId, room, redisClient);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                io.to(roomId).emit('score-update', room.players);
            }
            if (room.players.length === 0) delete rooms[roomId];
        }
        delete users[socket.id];
    });
};
