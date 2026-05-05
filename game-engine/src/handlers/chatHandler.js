const { rooms, users } = require('../state');
const { checkRoundStatus } = require('../utils/gameLogic');

module.exports = (io, socket, redisClient) => {
    socket.on('chat-message', ({ roomId, message }) => {
        const room = rooms[roomId];
        const username = users[socket.id] || 'Anonymous';

        if (room && room.gameActive && room.currentWord) {
            const isDrawer = (room.drawerId === socket.id);
            
            if (isDrawer) {
                socket.emit('error-msg', 'Drawers cannot use the chat!');
                return;
            }

            const isGuesserCorrect = room.correctGuessers.includes(socket.id);
            const isWordMatch = message.trim().toLowerCase() === room.currentWord.toLowerCase();

            if (!isGuesserCorrect && isWordMatch) {
                // Correct guess!
                room.correctGuessers.push(socket.id);
                
                const elapsedSeconds = (Date.now() - room.roundStartTime) / 1000;
                let points = 10;
                if (elapsedSeconds <= 10) points = 100;
                else if (elapsedSeconds <= 20) points = 75;
                else if (elapsedSeconds <= 30) points = 50;
                else if (elapsedSeconds <= 40) points = 30;
                else if (elapsedSeconds <= 50) points = 20;

                const guesser = room.players.find(p => p.id === socket.id);
                const drawer = room.players.find(p => p.id === room.drawerId);
                
                if (guesser) guesser.score += points;
                
                // Drawer gets a bonus for the first correct guess
                if (room.correctGuessers.length === 1 && drawer) {
                    drawer.score += 50;
                }

                io.to(roomId).emit('system-message', `🎉 ${username} guessed the word in ${Math.round(elapsedSeconds)}s! (+${points} pts)`);
                io.to(roomId).emit('score-update', room.players);
                socket.emit('guess-success');

                // Check if round should end
                checkRoundStatus(io, roomId, room, redisClient);
                return;
            } else if (isGuesserCorrect && isWordMatch) {
                socket.emit('error-msg', 'You cannot send the secret word!');
                return;
            } else {
                io.to(roomId).emit('chat-message', { sender: username, message, isIncorrectGuess: !isGuesserCorrect });
                return;
            }
        }

        // Normal chat
        io.to(roomId).emit('chat-message', { sender: username, message, isIncorrectGuess: false });
    });
};
