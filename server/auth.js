const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const users = new Map();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

function initializeUsers() {
  const defaultUsername = process.env.DEFAULT_USERNAME || 'admin';
  const defaultPassword = process.env.DEFAULT_PASSWORD || 'admin123';
  const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
  
  users.set(defaultUsername, {
    username: defaultUsername,
    password: hashedPassword,
    createdAt: new Date()
  });
}

initializeUsers();

function generateToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

async function login(username, password) {
  const user = users.get(username);

  if (!user) {
    throw new Error('User not found');
  }

  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    throw new Error('Invalid password');
  }

  return generateToken(username);
}

function getUser(username) {
  return users.get(username);
}

module.exports = {
  generateToken,
  verifyToken,
  login,
  getUser
};
