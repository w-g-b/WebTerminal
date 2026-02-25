const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const users = new Map();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

function initializeUsers() {
  const adminPassword = bcrypt.hashSync('admin123', 10);
  users.set('admin', {
    username: 'admin',
    password: adminPassword,
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

async function register(username, password) {
  if (users.has(username)) {
    throw new Error('User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.set(username, {
    username,
    password: hashedPassword,
    createdAt: new Date()
  });

  return generateToken(username);
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

module.exports = {
  generateToken,
  verifyToken,
  register,
  login
};
