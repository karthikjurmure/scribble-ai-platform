function appendChatMessage(sender, text, type = 'normal') {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const div = document.createElement('div');
    div.className = `chat-message ${type}`;

    if (type === 'system') {
        div.textContent = text;
    } else {
        div.innerHTML = `<span class="username">${sender}:</span><span class="text"></span>`;
        div.querySelector('.text').textContent = text;
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateLeaderboard(players) {
    const list = document.getElementById('leaderboardList');
    if (!list) return;

    // players is now an array: [{ id, username, score }]
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    list.innerHTML = '';
    sortedPlayers.forEach(p => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `<span class="name">${p.username}</span><span class="score">${p.score}</span>`;
        list.appendChild(item);
    });

    // Sync start button state based on player count
    const startBtn = document.getElementById('StartBtn');
    if (startBtn) {
        if (players.length < 2) {
            startBtn.classList.add('disabled');
            startBtn.title = "Need 2+ players to start";
        } else {
            startBtn.classList.remove('disabled');
            startBtn.title = "";
        }
    }
}

function updateTimer(remainingTime) {
    const timerDisplay = document.getElementById('TimerDisplay');
    const timerText = document.getElementById('TimerText');
    if (!timerDisplay || !timerText) return;

    timerDisplay.style.display = 'block';
    let secondsLeft = Math.ceil(remainingTime / 1000);
    timerText.textContent = secondsLeft;

    if (window.timerInterval) clearInterval(window.timerInterval);
    window.timerInterval = setInterval(() => {
        secondsLeft--;
        timerText.textContent = secondsLeft;
        if (secondsLeft <= 0) clearInterval(window.timerInterval);
    }, 1000);
}

socket.on('chat-message', ({ sender, message, isIncorrectGuess }) => {
    appendChatMessage(sender, message, isIncorrectGuess ? 'incorrect' : 'normal');
});

socket.on('system-message', (msg) => {
    appendChatMessage('System', msg, 'system');
});

socket.on('score-update', updateLeaderboard);

socket.on('ai-guess', (guess) => {
    const chatBox = document.getElementById('chatMessages');
    if (!chatBox) return;

    const aiMsg = document.createElement('div');
    aiMsg.className = 'chat-message system';
    aiMsg.style.cssText = `
        color: #3b82f6;
        background-color: #f0f7ff;
        padding: 8px;
        border-radius: 8px;
        margin: 4px 0;
        font-size: 0.9em;
    `;
    aiMsg.innerHTML = `<strong>🤖 AI Bot:</strong> I think this is a <em>${guess.label}</em> (${guess.confidence}%)`;
    
    chatBox.appendChild(aiMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('game-over', ({ leaderboard, winner }) => {
    appendChatMessage('System', `🎮 GAME OVER! Winner is ${winner.username} with ${winner.score} pts!`, 'system');
    
    // Show a modal or overlay if needed, but for now just system message and clear word display
    const wordDisplay = document.getElementById('WordDisplay');
    if (wordDisplay) {
        wordDisplay.innerHTML = `<h2 style="color: #f59e0b;">🏆 Winner: ${winner.username}!</h2>`;
    }
    
    const startBtn = document.getElementById('StartBtn');
    if (startBtn) startBtn.style.display = 'inline-block';
});
