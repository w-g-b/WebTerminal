const terminalManager = require('./terminal');
const { sanitizeCommand } = require('./utils/commandFilter');

function setupSocket(io) {
  io.on('connection', (socket) => {
    const userId = socket.user?.username || 'anonymous';

    console.log(`User connected: ${userId}, socket id: ${socket.id}`);

    socket.socketSessions = new Set();

    socket.on('create_session', () => {
      try {
        console.log(`[DEBUG] Creating session for user ${userId}`);
        const sessionCallback = (sessionId, action) => {
          console.log(`[DEBUG] sessionCallback triggered for session ${sessionId}, action: ${action}`);
          
          if (action === 'warning') {
            console.log(`[DEBUG] Sending session_timeout_warning event to socket ${socket.id}`);
            socket.emit('session_timeout_warning', { sessionId, remainingTime: 30 });
          } else if (action === 'close') {
            socket.socketSessions.delete(sessionId);
            console.log(`[DEBUG] Emitting session_closed event to socket ${socket.id}`);
            socket.emit('session_closed', { sessionId });
            console.log(`Session ${sessionId} closed by timeout`);
          }
        };

        const session = terminalManager.createSession(userId, sessionCallback);
        console.log(`[DEBUG] Session created successfully with ID: ${session.id}, timeout: ${parseInt(process.env.SESSION_TIMEOUT || '300000')}ms`);
        
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

        console.log(`Session created: ${session.id} by user: ${userId}, socket ${socket.id}`);

      } catch (error) {
        console.error(`[ERROR] Failed to create session:`, error);
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
    
    socket.on('acknowledge_warning', ({ sessionId }) => {
      try {
        console.log(`Received acknowledge_warning for session ${sessionId} from socket ${socket.id}`);
        terminalManager.acknowledgeWarning(sessionId);
        socket.emit('warning_acknowledged', { sessionId });
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
