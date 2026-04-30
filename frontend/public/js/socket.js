const socket = io('http://localhost:3000');
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
