const express = require('express');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// 导入其他模块
const { setupSocket } = require('./server/socket');
const terminalManager = require('./server/terminal');
const { authMiddleware } = require('./server/middleware/authMiddleware');
const { login, register, verifyToken } = require('./server/auth');

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// API 认证
app.use(express.json());

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const token = await register(username, password);
    res.json({ token, username });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const token = await login(username, password);
    res.json({ token, username });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, user: req.user });
});

app.get('/api/status', authMiddleware, (req, res) => {
  res.json({ 
    status: 'ok',
    user: req.user,
    stats: terminalManager.getStats()
  });
});

// WebSocket 连接
setupSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Unified server running on port ${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
});

module.exports = app;