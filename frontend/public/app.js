const socket = io('http://localhost:3000');
const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let drawing = false;
let isNewStroke = false;
let currentroomId = null;

// ── Room ───────────────────────────────────────────────────────────────────
function joinRoom() {
    const id = document.getElementById('roomIdInput').value.trim();
    if (id) {
        currentroomId = id;
        socket.emit('join-room', id);
        clearLocalCanvas(); // only wipe THIS user's canvas, don't broadcast
        document.getElementById('roomStatus').textContent = `✅ Room: ${id}`;
        document.getElementById('roomIdInput').disabled = true;
        document.getElementById('joinBtn').disabled = true;
    }
}

// ── Drawing events ─────────────────────────────────────────────────────────
canvas.addEventListener('mousedown', () => {
    drawing = true;
    isNewStroke = true;
    ctx.beginPath();
});
canvas.addEventListener('mouseup', () => {
    drawing = false;
    ctx.beginPath();
});
canvas.addEventListener('mouseleave', () => {
    drawing = false;
    ctx.beginPath();
});
canvas.addEventListener('mousemove', draw);

function draw(e) {
    if (!drawing || !currentroomId) return;
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

// Replay canvas history when joining a room that already has drawings
socket.on('load-history', (history) => {
    history.forEach(data => drawOnCanvas(data));
});

// Another user (or server) cleared the canvas
socket.on('clear-canvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Only clears this user's canvas — used when joining a room
function clearLocalCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Clears this user's canvas AND broadcasts to everyone in the room
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentroomId) {
        socket.emit('clear-canvas', currentroomId);
    }
}

socket.on('connect', () => {
    status.innerText = 'Connected!';
    status.style.color = 'green';
});