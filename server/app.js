const express = require('express');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 90000,
  pingInterval: 30000,
  maxHttpBufferSize: 1e6
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// API 路由
app.use('/api', require('./index'));

// WebSocket
const { setupSocket } = require('./socket');
const { socketAuthMiddleware } = require('./middleware/authMiddleware');
io.use(socketAuthMiddleware);
setupSocket(io);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;