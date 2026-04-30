const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');

let isDrawing = false;
let isNewStroke = false;

function setupCanvas() {
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

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || !isDrawingAllowed || !currentroomId) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const drawData = { x, y, isNewStroke };
        drawOnCanvas(drawData);
        socket.emit('draw-data', { roomId: currentroomId, data: drawData });
        isNewStroke = false;
    });
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

function clearLocalCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function clearCanvas() {
    clearLocalCanvas();
    if (currentroomId) {
        socket.emit('clear-canvas', currentroomId);
    }
}

socket.on('draw-data', (data) => drawOnCanvas(data));
socket.on('load-history', (history) => history.forEach(drawOnCanvas));
socket.on('clear-canvas', clearLocalCanvas);

setupCanvas();
