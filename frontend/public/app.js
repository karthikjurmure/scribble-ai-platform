const socket = io('http://localhost:3000');
const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

let isDrawingAllowed = false;   // only true when this user is the drawer
let isDrawing = false;          // true while mouse button is held
let isNewStroke = false;
let currentroomId = null;
let currentUsername = null;
let timerInterval = null;

// ── Room ───────────────────────────────────────────────────────────────────
function joinRoom() {
    const username = document.getElementById('usernameInput').value.trim();
    const id = document.getElementById('roomIdInput').value.trim();
    if (!username || !id) {
        alert("Enter both username and room ID");
        return;
    }
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
    if (!currentroomId) {
        alert('Join a room first');
        return;
    }
    socket.emit('start-game', currentroomId);
}

// ── Game events ────────────────────────────────────────────────────────────
socket.on('game-started', ({ role, word, remainingTime }) => {
    const wordDisplay = document.getElementById('WordDisplay');
    const startBtn = document.getElementById('StartBtn');
    const guessArea = document.getElementById('guessArea');
    const timerDisplay = document.getElementById('TimerDisplay');
    const timerText = document.getElementById('TimerText');

    clearLocalCanvas(); // fresh canvas for new round

    if (role === 'drawer') {
        isDrawingAllowed = true;
        if (wordDisplay) wordDisplay.textContent = `✏️ Your turn! Draw: "${word}"`;
        if (startBtn) startBtn.style.display = 'none';
        const chatInputArea = document.getElementById('chatInputArea');
        if (chatInputArea) chatInputArea.style.display = 'flex';
    } else {
        isDrawingAllowed = false;
        if (wordDisplay) {
            wordDisplay.textContent = word ? `🔍 Guess the word: ${word}` : '🔍 Guess the word!';
        }
        if (startBtn) startBtn.style.display = 'none';
        const chatInputArea = document.getElementById('chatInputArea');
        if (chatInputArea) chatInputArea.style.display = 'flex';
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.value = '';
            chatInput.focus();
        }
    }

    // Start Timer
    if (timerDisplay && timerText && remainingTime) {
        timerDisplay.style.display = 'block';
        let secondsLeft = Math.ceil(remainingTime / 1000);
        timerText.textContent = secondsLeft;

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            secondsLeft--;
            timerText.textContent = secondsLeft;
            if (secondsLeft <= 0) {
                clearInterval(timerInterval);
            }
        }, 1000);
    }
});

socket.on('guess-success', () => {
    const wordDisplay = document.getElementById('WordDisplay');
    if (wordDisplay) wordDisplay.textContent = '🏆 You guessed it!';
    // Leave the timer running and chat active
});

socket.on('round-over', ({ reason }) => {
    const wordDisplay = document.getElementById('WordDisplay');
    const startBtn = document.getElementById('StartBtn');
    const timerDisplay = document.getElementById('TimerDisplay');

    if (wordDisplay) wordDisplay.textContent = '⏰ Time is up!';
    if (startBtn) startBtn.style.display = 'inline-block';
    if (timerDisplay) timerDisplay.style.display = 'none';
    if (timerInterval) clearInterval(timerInterval);
    isDrawingAllowed = false;
});

socket.on('word-hint-update', (hint) => {
    const wordDisplay = document.getElementById('WordDisplay');
    if (wordDisplay && wordDisplay.textContent !== '🏆 You guessed it!' && !isDrawingAllowed) {
        wordDisplay.textContent = `🔍 Guess the word: ${hint}`;
    }
});

// ── Chat & Guesses ─────────────────────────────────────────────────────────
function sendChat() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message || !currentroomId) return;
    socket.emit('chat-message', { roomId: currentroomId, message });
    input.value = '';
    input.focus();
}

// Allow pressing Enter in the chat input
const chatInput = document.getElementById('chatInput');
if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendChat();
    });
}

function appendChatMessage(sender, text, type = 'normal') {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const div = document.createElement('div');
    div.className = `chat-message ${type}`;

    if (type === 'system') {
        div.textContent = text;
    } else {
        div.innerHTML = `<span class="username">${sender}:</span><span class="text"></span>`;
        div.querySelector('.text').textContent = text; // safe text insertion
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

socket.on('chat-message', ({ sender, message, isIncorrectGuess }) => {
    appendChatMessage(sender, message, isIncorrectGuess ? 'incorrect' : 'normal');
});

socket.on('system-message', (msg) => {
    appendChatMessage('System', msg, 'system');
});

socket.on('error-msg', (msg) => {
    alert(`⚠️ ${msg}`);
});

// ── Drawing events ─────────────────────────────────────────────────────────
canvas.addEventListener('mousedown', () => {
    if (!isDrawingAllowed) return;
    isDrawing = true;
    isNewStroke = true;
    ctx.beginPath();
});
canvas.addEventListener('mouseup', () => {
    isDrawing = false;
    ctx.beginPath();
});
canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
    ctx.beginPath();
});
canvas.addEventListener('mousemove', draw);

function draw(e) {
    if (!isDrawing || !isDrawingAllowed || !currentroomId) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const drawData = { x, y, isNewStroke };
    drawOnCanvas(drawData);
    socket.emit('draw-data', { roomId: currentroomId, data: drawData });
    isNewStroke = false;
}

function drawOnCanvas(data) {
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';

    if (data.isNewStroke) {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
    } else {
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
    }
}

// ── Socket listeners ───────────────────────────────────────────────────────
socket.on('draw-data', (data) => {
    drawOnCanvas(data);
});

socket.on('load-history', (history) => {
    history.forEach(data => drawOnCanvas(data));
});

socket.on('clear-canvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// ── Canvas utilities ───────────────────────────────────────────────────────
function clearLocalCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentroomId) {
        socket.emit('clear-canvas', currentroomId);
    }
}

// ── Connection status ──────────────────────────────────────────────────────
socket.on('connect', () => {
    status.textContent = '🟢 Connected';
    status.style.color = 'green';
});
socket.on('disconnect', () => {
    status.textContent = '🔴 Disconnected';
    status.style.color = 'red';
});

// ── Scores ─────────────────────────────────────────────────────────────────
socket.on('score-update', (scores) => {
    const list = document.getElementById('leaderboardList');
    if (!list) return;

    // Convert scores object to array and sort by score descending
    const sortedScores = Object.values(scores).sort((a, b) => b.score - a.score);

    list.innerHTML = '';
    sortedScores.forEach(s => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = s.username;

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'score';
        scoreSpan.textContent = s.score;

        item.appendChild(nameSpan);
        item.appendChild(scoreSpan);
        list.appendChild(item);
    });
});
