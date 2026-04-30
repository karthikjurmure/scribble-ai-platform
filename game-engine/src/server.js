require('dotenv').config({ path: require('path').join(__dirname, '../../game-engine/.env') });
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { createClient } = require('redis');

// Import Handlers
const registerRoomHandlers = require('./handlers/roomHandler');
const registerChatHandlers = require('./handlers/chatHandler');
const registerDrawingHandlers = require('./handlers/drawingHandler');

const app = express();
const server = http.createServer(app);

// ── Redis ──────────────────────────────────────────────────────────────────
const redisClient = createClient({
    url: process.env.REDIS_URL
});
redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect().then(() => console.log('🚀 Connected to Redis Cloud'));

// ── Static files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// ── Socket.IO ──────────────────────────────────────────────────────────────
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    // Register modular handlers
    registerRoomHandlers(io, socket, redisClient);
    registerChatHandlers(io, socket);
    registerDrawingHandlers(io, socket, redisClient);
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`✅ Game server running on port: ${port}`);
});