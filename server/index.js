const express = require('express');
const { authMiddleware } = require('./middleware/authMiddleware');
const { login } = require('./auth');

const router = express.Router();

router.post('/auth/login', async (req, res) => {
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

router.post('/auth/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, user: req.user });
});

router.get('/status', authMiddleware, (req, res) => {
  const terminalManager = require('./terminal');
  res.json({ 
    status: 'ok',
    user: req.user,
    stats: terminalManager.getStats()
  });
});

module.exports = router;
