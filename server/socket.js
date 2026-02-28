const terminalManager = require('./terminal');
const { sanitizeCommand } = require('./utils/commandFilter');
const logger = require('./utils/logger');

function setupSocket(io) {
  io.on('connection', (socket) => {
    const userId = socket.user?.username || 'anonymous';

    logger.socket(userId, 'connected');
    socket.socketSessions = new Set();

    socket.on('ping', (data) => {
      logger.request(userId, 'ping');
      socket.emit('pong', data);

      socket.socketSessions.forEach(sessionId => {
        try {
          terminalManager.refreshTimeout(sessionId);
        } catch (error) {
          logger.error(`Failed to refresh timeout for session ${sessionId}: ${error.message}`);
        }
      });
    });

    socket.on('create_session', () => {
      try {
        logger.request(userId, 'create_session');

        if (socket.socketSessions.size >= 1) {
          logger.warn(`Socket already has a session, closing existing session(s)`);
          socket.socketSessions.forEach(existingSessionId => {
            try {
              terminalManager.closeSession(existingSessionId);
              logger.session(existingSessionId, 'closed on new create request');
            } catch (error) {
              logger.error(`Failed to close existing session ${existingSessionId}: ${error.message}`);
            }
          });
          socket.socketSessions.clear();
        }

        const sessionCallback = (sessionId, action) => {
          const session = terminalManager.getSession(sessionId);
          if (!session || session.closed) {
            return;
          }

          if (action === 'warning') {
            socket.emit('session_timeout_warning', { sessionId, remainingTime: 30 });
            logger.session(sessionId, 'timeout warning');
          } else if (action === 'close') {
            socket.socketSessions.delete(sessionId);
            socket.emit('session_closed', { sessionId });
            logger.session(sessionId, 'timeout closed');
          }
        };

        const session = terminalManager.createSession(userId, sessionCallback);
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

        logger.session(session.id, 'created', userId);

      } catch (error) {
        logger.error(`Failed to create session: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('input_command', ({ sessionId, command }) => {
      try {
        const session = terminalManager.getSession(sessionId);
        if (!session || session.closed) {
          logger.error(`Invalid or closed session: ${sessionId}`);
          socket.emit('error', { message: 'Invalid or closed session' });
          return;
        }

        terminalManager.write(sessionId, command);
      } catch (error) {
        logger.error(`input_command failed: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });
    
    socket.on('acknowledge_warning', ({ sessionId }) => {
      try {
        const session = terminalManager.getSession(sessionId);
        if (!session || session.closed) {
          logger.error(`Invalid or closed session: ${sessionId}`);
          socket.emit('error', { message: 'Invalid or closed session' });
          return;
        }

        terminalManager.acknowledgeWarning(sessionId);
        socket.emit('warning_acknowledged', { sessionId });
      } catch (error) {
        logger.error(`acknowledge_warning failed: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('resize', ({ sessionId, cols, rows }) => {
      try {
        const session = terminalManager.getSession(sessionId);
        if (!session || session.closed) {
          logger.error(`Invalid or closed session: ${sessionId}`);
          socket.emit('error', { message: 'Invalid or closed session' });
          return;
        }

        terminalManager.resize(sessionId, cols, rows);
      } catch (error) {
        logger.error(`resize failed: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('close_session', ({ sessionId }) => {
      try {
        const session = terminalManager.getSession(sessionId);
        if (!session || session.closed) {
          socket.socketSessions.delete(sessionId);
          return;
        }

        terminalManager.closeSession(sessionId);
        socket.socketSessions.delete(sessionId);
        socket.emit('session_closed', { sessionId });
        logger.session(sessionId, 'closed by', userId);
      } catch (error) {
        logger.error(`close_session failed: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('list_sessions', () => {
      try {
        const sessions = terminalManager.getUserSessions(userId);
        const sessionList = sessions.map(s => ({
          id: s.id,
          createdAt: s.createdAt
        }));
        socket.emit('sessions_list', sessionList);
      } catch (error) {
        logger.error(`list_sessions failed: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('disconnect', () => {
      try {
        logger.socket(userId, 'disconnected', `closing ${socket.socketSessions.size} sessions`);
        const sessionIds = Array.from(socket.socketSessions);
        socket.socketSessions.clear();

        sessionIds.forEach(sessionId => {
          try {
            const session = terminalManager.getSession(sessionId);
            if (session && !session.closed) {
              terminalManager.closeSession(sessionId);
            }
          } catch (error) {
            logger.error(`Failed to close session ${sessionId}: ${error.message}`);
          }
        });
      } catch (error) {
        logger.error(`disconnect handler failed: ${error.message}`);
      }
    });

    socket.emit('connected', { userId });
  });
}

module.exports = { setupSocket };
