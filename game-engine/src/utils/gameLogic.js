const words = require('./words.json');

function startTurn(io, roomId, room, redisClient) {
    if (!room) return;

    // Pick word
    const wordEntry = words[Math.floor(Math.random() * words.length)];
    const word = typeof wordEntry === 'string' ? wordEntry : wordEntry.word;
    
    // Skip bots when picking a drawer
    let drawer = room.players[room.currentDrawerIndex];
    while (drawer && drawer.isBot) {
        room.currentDrawerIndex++;
        if (room.currentDrawerIndex >= room.players.length) {
            endGame(io, roomId, room);
            return;
        }
        drawer = room.players[room.currentDrawerIndex];
    }

    if (!drawer) {
        endGame(io, roomId, room);
        return;
    }

    room.currentWord = word;
    room.drawerId = drawer.id;
    room.correctGuessers = [];
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
        nextTurn(io, roomId, room, redisClient);
    }, 60000);

    // Notify players
    room.players.forEach((player) => {
        const isDrawer = player.id === drawer.id;
        const role = isDrawer ? 'drawer' : 'guesser';
        const sentWord = isDrawer ? word : room.hintArray.join(' ');
        io.to(player.id).emit('game-started', { 
            role, 
            word: sentWord, 
            remainingTime: 60000,
            drawerName: drawer.username
        });
    });
}

function nextTurn(io, roomId, room, redisClient) {
    if (!room) return;

    // Cleanup current round
    if (room.timeoutId) clearTimeout(room.timeoutId);
    clearHintTimeouts(room);
    io.to(roomId).emit('round-over', { word: room.currentWord });

    // Reset AI flag
    room.aiGuessedThisRound = false;

    room.currentDrawerIndex++;
    
    if (room.currentDrawerIndex >= room.players.length) {
        endGame(io, roomId, room);
    } else {
        // Start next turn after a short delay
        setTimeout(() => {
            startTurn(io, roomId, room, redisClient);
        }, 3000);
    }
}

function checkRoundStatus(io, roomId, room, redisClient) {
    if (!room) return;
    
    const requiredGuessers = room.players.length - 1;
    const currentCorrect = room.correctGuessers.length;
    
    console.log(`[Round Status] Room: ${roomId}, Correct: ${currentCorrect}/${requiredGuessers}`);
    
    if (currentCorrect >= requiredGuessers && requiredGuessers > 0) {
        console.log(`[Round Status] All guessers finished! Moving to next turn.`);
        nextTurn(io, roomId, room, redisClient);
    }
}

function endGame(io, roomId, room) {
    room.gameActive = false;
    const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    io.to(roomId).emit('game-over', { 
        leaderboard: sortedPlayers,
        winner: winner
    });
}

// ... rest of the functions (setupHints, etc.)

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
                if (!room.gameActive) return;
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

module.exports = { startTurn, nextTurn, checkRoundStatus, clearHintTimeouts };
