const { verifyToken } = require('../auth');

function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = decoded;
  next();
}

function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return next(new Error('Authentication error: Invalid token'));
  }

  socket.user = decoded;
  next();
}

module.exports = { authMiddleware, socketAuthMiddleware };
