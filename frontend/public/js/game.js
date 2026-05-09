let isDrawingAllowed = false;
let currentroomId = null;
let currentUsername = null;

function joinRoom() {
    const username = document.getElementById('usernameInput').value.trim();
    const id = document.getElementById('roomIdInput').value.trim();
    if (!username || !id) return alert("Enter both username and room ID");

    currentroomId = id;
    currentUsername = username;
    socket.emit('join-room', { roomId: id, username });
    
    clearLocalCanvas();
    document.getElementById('roomStatus').textContent = `✅ Room: ${id}`;
    document.getElementById('usernameInput').disabled = true;
    document.getElementById('roomIdInput').disabled = true;
    document.getElementById('joinBtn').disabled = true;
}

function startGame() {
    if (!currentroomId) return alert('Join a room first');
    socket.emit('start-game', currentroomId);
}

function sendChat() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message || !currentroomId) return;
    socket.emit('chat-message', { roomId: currentroomId, message });
    input.value = '';
    input.focus();
}

// Event Listeners
document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
});

socket.on('game-started', ({ role, word, remainingTime, drawerName }) => {
    const wordDisplay = document.getElementById('WordDisplay');
    const startBtn = document.getElementById('StartBtn');
    const chatInputArea = document.getElementById('chatInputArea');

    clearLocalCanvas();
    isDrawingAllowed = (role === 'drawer');
    
    const drawingToolbar = document.getElementById('drawingToolbar');
    
    if (wordDisplay) {
        if (isDrawingAllowed) {
            wordDisplay.innerHTML = `<span class="drawer-notice">✏️ Your turn! Draw:</span> <strong class="word-reveal">"${word}"</strong>`;
            if (drawingToolbar) drawingToolbar.style.display = 'flex';
        } else {
            wordDisplay.innerHTML = `<span class="drawer-notice">🔍 <strong>${drawerName}</strong> is drawing:</span> <strong class="word-reveal">${word || ''}</strong>`;
            if (drawingToolbar) drawingToolbar.style.display = 'none';
        }
    }
    if (startBtn) startBtn.style.display = 'none';
    if (chatInputArea) chatInputArea.style.display = 'flex';
    
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');
    
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) clearBtn.disabled = !isDrawingAllowed;

    if (chatInput && sendBtn) {
        if (isDrawingAllowed) {
            chatInput.disabled = true;
            chatInput.placeholder = "Drawers cannot chat!";
            sendBtn.disabled = true;
        } else {
            chatInput.disabled = false;
            chatInput.placeholder = "Type your guess here...";
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }

    updateTimer(remainingTime);
});

socket.on('guess-success', () => {
    const wordDisplay = document.getElementById('WordDisplay');
    if (wordDisplay) wordDisplay.textContent = '🏆 You guessed it!';
});

socket.on('round-over', ({ word }) => {
    const wordDisplay = document.getElementById('WordDisplay');
    const startBtn = document.getElementById('StartBtn');
    const timerDisplay = document.getElementById('TimerDisplay');

    const drawingToolbar = document.getElementById('drawingToolbar');
    if (drawingToolbar) drawingToolbar.style.display = 'none';

    if (wordDisplay) {
        wordDisplay.innerHTML = `⏰ Round Over! The word was: <strong class="word-reveal">"${word}"</strong>`;
    }
    // We don't show the start button here because nextTurn handles game flow
    if (timerDisplay) timerDisplay.style.display = 'none';
    if (window.timerInterval) clearInterval(window.timerInterval);
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) clearBtn.disabled = true;

    isDrawingAllowed = false;
});

socket.on('word-hint-update', (hint) => {
    const wordDisplay = document.getElementById('WordDisplay');
    if (wordDisplay && wordDisplay.textContent !== '🏆 You guessed it!' && !isDrawingAllowed) {
        wordDisplay.textContent = `🔍 Guess the word: ${hint}`;
    }
});

// AI Periodic Snapshot
setInterval(() => {
    if (isDrawingAllowed && currentroomId) {
        const dataURL = canvas.toDataURL('image/png');
        socket.emit('canvas-snapshot', { roomId: currentroomId, image: dataURL });
    }
}, 15000);
