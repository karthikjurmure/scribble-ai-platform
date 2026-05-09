const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');

let isDrawing = false;
let isNewStroke = false;
let currentBrushSize = 5;
let currentBrushColor = '#000000';

function setupCanvas() {
    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // Normalize coordinates based on canvas internal resolution vs CSS displayed size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    // --- MOUSE EVENTS ---
    canvas.addEventListener('mousedown', (e) => {
        if (!isDrawingAllowed) return;
        isDrawing = true;
        isNewStroke = true;
        ctx.beginPath();
        
        const pos = getPos(e);
        const drawData = { x: pos.x, y: pos.y, isNewStroke, size: currentBrushSize, color: currentBrushColor };
        drawOnCanvas(drawData);
        socket.emit('draw-data', { roomId: currentroomId, data: drawData });
        isNewStroke = false;
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
        const pos = getPos(e);
        const drawData = { x: pos.x, y: pos.y, isNewStroke, size: currentBrushSize, color: currentBrushColor };
        drawOnCanvas(drawData);
        socket.emit('draw-data', { roomId: currentroomId, data: drawData });
        isNewStroke = false;
    });

    // --- TOUCH EVENTS (MOBILE) ---
    canvas.addEventListener('touchstart', (e) => {
        if (!isDrawingAllowed) return;
        e.preventDefault(); // Stop scrolling
        isDrawing = true;
        isNewStroke = true;
        ctx.beginPath();

        const pos = getPos(e);
        const drawData = { x: pos.x, y: pos.y, isNewStroke, size: currentBrushSize, color: currentBrushColor };
        drawOnCanvas(drawData);
        socket.emit('draw-data', { roomId: currentroomId, data: drawData });
        isNewStroke = false;
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!isDrawing || !isDrawingAllowed || !currentroomId) return;
        e.preventDefault(); // Stop scrolling
        
        const pos = getPos(e);
        const drawData = { x: pos.x, y: pos.y, isNewStroke, size: currentBrushSize, color: currentBrushColor };
        
        drawOnCanvas(drawData);
        socket.emit('draw-data', { roomId: currentroomId, data: drawData });
        isNewStroke = false;
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        isDrawing = false;
        ctx.beginPath();
    });

    canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        isDrawing = false;
        ctx.beginPath();
    });
}

function drawOnCanvas(data) {
    ctx.lineWidth = data.size || 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = data.color || '#000';

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

function setBrushSize(size) {
    currentBrushSize = size;
    // Update active UI state
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText === '●' && parseInt(window.getComputedStyle(btn).fontSize) === (size === 2 ? 8 : size === 5 ? 14 : 20)) {
             // simplified check
        }
    });
    // Let's just use a simpler selector since I know the structure
    const btns = document.querySelectorAll('.tool-btn');
    if (size === 2) { btns[0].classList.add('active'); btns[1].classList.remove('active'); btns[2].classList.remove('active'); }
    if (size === 5) { btns[0].classList.remove('active'); btns[1].classList.add('active'); btns[2].classList.remove('active'); }
    if (size === 10) { btns[0].classList.remove('active'); btns[1].classList.remove('active'); btns[2].classList.add('active'); }
}

function setBrushColor(color) {
    currentBrushColor = color;
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.style.backgroundColor === color || btn.getAttribute('style').includes(color)) {
            btn.classList.add('active');
        }
    });
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
