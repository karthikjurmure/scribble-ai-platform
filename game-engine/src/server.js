require('dotenv').config({ path: require('path').join(__dirname, '../../game-engine/.env') });
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { createClient } = require('redis');

const app = express();
const server = http.createServer(app);

// ── Redis ──────────────────────────────────────────────────────────────────
const redisClient = createClient({
    url: process.env.REDIS_URL
});
redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect().then(() => {
    console.log('🚀 Connected to Redis Cloud');
});

// ── Static files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// ── Socket.IO ──────────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: { origin: '*' }
});

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on('join-room', async (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);

        // Send existing canvas history to the newly joined user
        const history = await redisClient.lRange(`room:${roomId}:history`, 0, -1);
        if (history.length > 0) {
            const parsedHistory = history.map(item => JSON.parse(item));
            socket.emit('load-history', parsedHistory);
        }
    });

    socket.on('draw-data', async ({ roomId, data }) => {
        // Persist stroke to Redis (TTL: 2 hours)
        await redisClient.rPush(`room:${roomId}:history`, JSON.stringify(data));
        await redisClient.expire(`room:${roomId}:history`, 7200);
        socket.to(roomId).emit('draw-data', data);
    });

    socket.on('clear-canvas', async (roomId) => {
        await redisClient.del(`room:${roomId}:history`);
        socket.to(roomId).emit('clear-canvas');
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const port = 3000;
server.listen(port, () => {
    console.log(`server is running on port: ${port}`);
});
