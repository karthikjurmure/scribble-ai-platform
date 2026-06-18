const axios = require('axios');
const FormData = require('form-data');
const { rooms } = require('../state');
const { checkRoundStatus } = require('../utils/gameLogic');

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
        if (!room || !room.gameActive || !room.currentWord) return;

        // Skip if AI already guessed correctly
        if (room.aiGuessedThisRound || room.correctGuessers.includes('ai_bot')) return;

        console.log(`[AI Bot] Processing snapshot for room ${roomId}, word: ${room.currentWord}`);

        try {
            const base64Data = image.replace(/^data:image\/png;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');

            const form = new FormData();
            form.append('file', buffer, { filename: 'drawing.png' });

            const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
            const response = await axios.post(`${aiUrl}/predict`, form, {
                headers: form.getHeaders(),
                timeout: 5000 // 5s timeout
            });

            if (!response.data || !response.data.guesses || response.data.guesses.length === 0) {
                console.log("[AI Bot] No guesses returned from AI service");
                return;
            }

            const topGuess = response.data.guesses[0];
            const confidence = topGuess.confidence * 100;

            console.log(`[AI Bot] Top guess: ${topGuess.label} (${confidence.toFixed(1)}%)`);

            // Double check flag here too to prevent race condition
            if (room.aiGuessedThisRound) return;

            // Logic for AI matching the word
            const isMatch = topGuess.label.toLowerCase().replace(/\s+/g, '') === 
                            room.currentWord.toLowerCase().replace(/\s+/g, '');

            if (isMatch) {
                console.log(`[AI Bot] Correct guess! Confidence: ${confidence.toFixed(1)}%`);
                room.aiGuessedThisRound = true; // Set flag immediately
                
                handleAiCorrectGuess(io, roomId, room, redisClient, points => {
                    io.to(roomId).emit('system-message', `🤖 AI bot guessed the word in ${points.elapsed}s! (+${points.val} pts)`);
                    io.to(roomId).emit('score-update', room.players);
                });
            } else {
                // Only emit thinking message if it's NOT the correct word (to avoid spoiling)
                io.to(roomId).emit('ai-guess', {
                    label: topGuess.label,
                    confidence: confidence.toFixed(0)
                });
            }
        } catch (error) {
            console.error("[AI Bot] Error:", error.message);
            if (error.code === 'ECONNREFUSED') {
                console.error("[AI Bot] Could not connect to AI service. Is it running on port 8000?");
            }
        }
    });
};

function handleAiCorrectGuess(io, roomId, room, redisClient, callback) {
    if (room.correctGuessers.includes('ai_bot')) return;
    
    room.correctGuessers.push('ai_bot');
    const elapsedSeconds = (Date.now() - room.roundStartTime) / 1000;
    
    let points = 10;
    if (elapsedSeconds <= 10) points = 100;
    else if (elapsedSeconds <= 20) points = 75;
    else if (elapsedSeconds <= 30) points = 50;
    else if (elapsedSeconds <= 40) points = 30;
    else if (elapsedSeconds <= 50) points = 20;

    const aiBot = room.players.find(p => p.id === 'ai_bot');
    if (aiBot) {
        aiBot.score += points;
    }
    if (room.correctGuessers.length === 1) {
        const drawer = room.players.find(p => p.id === room.drawerId);
        if (drawer) drawer.score += 50;
    }

    callback({ val: points, elapsed: Math.round(elapsedSeconds) });

    // Check if round should end
    checkRoundStatus(io, roomId, room, redisClient);
}
