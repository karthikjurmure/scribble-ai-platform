const axios = require('axios');
const FormData = require('form-data');
const { rooms } = require('../state');

module.exports = (io, socket, redisClient) => {
    
    socket.on('draw-data', async ({ roomId, data }) => {
        // Persist stroke to Redis (TTL: 2 hours)
        await redisClient.rPush(`room:${roomId}:history`, JSON.stringify(data));
        await redisClient.expire(`room:${roomId}:history`, 7200);
        socket.to(roomId).emit('draw-data', data);
    });

    socket.on('clear-canvas', async (roomId) => {
        await redisClient.del(`room:${roomId}:history`);
        io.to(roomId).emit('clear-canvas');
    });

    socket.on('canvas-snapshot', async ({ roomId, image }) => {
        const room = rooms[roomId];
        if (!room || !room.isPlaying || !room.currentWord) return;

        // Skip if AI already guessed correctly
        if (room.correctGuessers.includes('ai_bot')) return;

        try {
            const base64Data = image.replace(/^data:image\/png;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');

            const form = new FormData();
            form.append('file', buffer, { filename: 'drawing.png' });

            const response = await axios.post('http://localhost:8000/predict', form, {
                headers: form.getHeaders(),
            });

            const topGuess = response.data.guesses[0];
            const confidence = topGuess.confidence * 100;

            // Emit thinking message
            io.to(roomId).emit('ai-guess', {
                label: topGuess.label,
                confidence: confidence.toFixed(0)
            });

            // Logic for AI matching the word
            const isMatch = topGuess.label.toLowerCase().replace(/\s+/g, '') === 
                            room.currentWord.toLowerCase().replace(/\s+/g, '');

            if (isMatch && confidence > 45) {
                handleAiCorrectGuess(io, roomId, room, points => {
                    io.to(roomId).emit('system-message', `Ai bot guessed the word in ${points.elapsed}s and got ${points.val} pts!`);
                    io.to(roomId).emit('score-update', room.scores);
                });
            }
        } catch (error) {
            console.error("AI Service Error:", error.message);
        }
    });
};

function handleAiCorrectGuess(io, roomId, room, callback) {
    if (room.correctGuessers.includes('ai_bot')) return;
    
    room.correctGuessers.push('ai_bot');
    const elapsedSeconds = (Date.now() - room.roundStartTime) / 1000;
    
    let points = 20;
    if (elapsedSeconds <= 10) points = 100;
    else if (elapsedSeconds <= 20) points = 80;
    else if (elapsedSeconds <= 30) points = 50;

    if (!room.scores['ai_bot']) {
        room.scores['ai_bot'] = { username: '🤖 AI Bot', score: 0 };
    }
    room.scores['ai_bot'].score += points;

    callback({ val: points, elapsed: Math.round(elapsedSeconds) });

    // Check if round over
    const humanGuessersCount = room.correctGuessers.filter(id => id !== 'ai_bot').length;
    if (humanGuessersCount >= room.players.length - 1) {
        endRound(io, roomId, room);
    }
}

function endRound(io, roomId, room) {
    room.currentWord = null;
    room.isPlaying = false;
    if (room.timeoutId) clearTimeout(room.timeoutId);
    if (room.hintTimeouts) {
        room.hintTimeouts.forEach(t => clearTimeout(t));
        room.hintTimeouts = [];
    }
    io.to(roomId).emit('round-over', { reason: 'all-guessed' });
}
