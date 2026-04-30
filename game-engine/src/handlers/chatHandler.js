const { rooms, users } = require('../state');

module.exports = (io, socket) => {
    socket.on('chat-message', ({ roomId, message }) => {
        const room = rooms[roomId];
        const username = users[socket.id] || 'Anonymous';

        if (room && room.isPlaying && room.currentWord) {
            const isGuesserCorrect = room.correctGuessers.includes(socket.id);
            const isDrawer = (room.drawerId === socket.id);
            const isWordMatch = message.trim().toLowerCase() === room.currentWord.toLowerCase();

            if (!isGuesserCorrect && !isDrawer && isWordMatch) {
                // Correct guess!
                room.correctGuessers.push(socket.id);
                const elapsedSeconds = (Date.now() - room.roundStartTime) / 1000;
                
                let points = 20;
                if (elapsedSeconds <= 10) points = 100;
                else if (elapsedSeconds <= 20) points = 80;
                else if (elapsedSeconds <= 30) points = 50;

                if (room.scores[socket.id]) room.scores[socket.id].score += points;
                
                // Bonus for drawer
                if (room.correctGuessers.length === 1 && room.scores[room.drawerId]) {
                    room.scores[room.drawerId].score += 100;
                }

                io.to(roomId).emit('system-message', `🎉 ${username} guessed the word in ${Math.round(elapsedSeconds)}s and got ${points} pts!`);
                io.to(roomId).emit('score-update', room.scores);
                socket.emit('guess-success');

                // Check if all humans guessed
                const humanGuessersCount = room.correctGuessers.filter(id => id !== 'ai_bot').length;
                if (humanGuessersCount >= room.players.length - 1) {
                    room.currentWord = null;
                    room.isPlaying = false;
                    if (room.timeoutId) clearTimeout(room.timeoutId);
                    if (room.hintTimeouts) {
                        room.hintTimeouts.forEach(t => clearTimeout(t));
                        room.hintTimeouts = [];
                    }
                    io.to(roomId).emit('round-over', { reason: 'all-guessed' });
                }
                return;
            } else if ((isGuesserCorrect || isDrawer) && isWordMatch) {
                socket.emit('error-msg', 'You cannot send the secret word!');
                return;
            } else {
                io.to(roomId).emit('chat-message', { sender: username, message, isIncorrectGuess: !isGuesserCorrect && !isDrawer });
                return;
            }
        }

        // Normal chat
        io.to(roomId).emit('chat-message', { sender: username, message, isIncorrectGuess: false });
    });
};
