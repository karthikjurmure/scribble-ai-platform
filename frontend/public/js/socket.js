const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : 'https://YOUR-RENDER-URL.onrender.com'; // <-- CHANGE THIS TO YOUR RENDER URL

const socket = io(serverUrl);
const status = document.getElementById('status');

socket.on('connect', () => {
    status.textContent = '🟢 Connected';
    status.style.color = 'green';
});

socket.on('disconnect', () => {
    status.textContent = '🔴 Disconnected';
    status.style.color = 'red';
});

socket.on('error-msg', (msg) => {
    alert(`⚠️ ${msg}`);
});
