const terminalManager = require('./terminal');
const { sanitizeCommand } = require('./utils/commandFilter');

function setupSocket(io) {
  io.on('connection', (socket) => {
    const userId = socket.user?.username || 'anonymous';

    console.log(`User connected: ${userId}, socket id: ${socket.id}`);

    socket.socketSessions = new Set();

    socket.on('create_session', () => {
      try {
        const session = terminalManager.createSession(userId);
        
        socket.socketSessions.add(session.id);
        
        session.pty.onData((data) => {
          socket.emit('output_data', {
            sessionId: session.id,
            data: data
          });
        });

        socket.emit('session_created', {
          sessionId: session.id,
          stats: terminalManager.getStats()
        });

        console.log(`Session created: ${session.id} by user: ${userId}, socket id: ${socket.id}`);

      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('input_command', ({ sessionId, command }) => {
      try {
        console.log(`Received command from socket ${socket.id}: ${JSON.stringify({ sessionId, command: command.charCodeAt(0) })}`);
        terminalManager.write(sessionId, command);
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('resize', ({ sessionId, cols, rows }) => {
      try {
        terminalManager.resize(sessionId, cols, rows);
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('close_session', ({ sessionId }) => {
      try {
        terminalManager.closeSession(sessionId);
        socket.socketSessions.delete(sessionId);
        socket.emit('session_closed', { sessionId });
        console.log(`Session closed: ${sessionId} by user: ${userId}, socket id: ${socket.id}`);
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('list_sessions', () => {
      const sessions = terminalManager.getUserSessions(userId);
      socket.emit('sessions_list', sessions.map(s => ({
        id: s.id,
        createdAt: s.createdAt
      })));
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}, socket id: ${socket.id}, sessions closed: ${socket.socketSessions.size}`);
      socket.socketSessions.forEach(sessionId => {
        terminalManager.closeSession(sessionId);
      });
    });

    socket.emit('connected', { userId });
  });
}

module.exports = { setupSocket };
