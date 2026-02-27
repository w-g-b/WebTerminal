const terminalManager = require('./terminal');
const { sanitizeCommand } = require('./utils/commandFilter');

function getTimestamp() {
  return new Date().toISOString();
}

function log(message) {
  console.log(`[${getTimestamp()}] ${message}`);
}

function logError(message) {
  console.error(`[${getTimestamp()}] ${message}`);
}

function setupSocket(io) {
  io.on('connection', (socket) => {
    const userId = socket.user?.username || 'anonymous';

    log(`[SOCKET] ${userId} connected`);

    socket.socketSessions = new Set();

    socket.on('ping', (data) => {
      log(`[REQUEST] ping from ${userId}`);
      socket.emit('pong', data);

      socket.socketSessions.forEach(sessionId => {
        try {
          terminalManager.refreshTimeout(sessionId);
        } catch (error) {
          logError(`[ERROR] Failed to refresh timeout for session ${sessionId}: ${error.message}`);
        }
      });
    });

    socket.on('create_session', () => {
      try {
        log(`[REQUEST] create_session from ${userId}`);

        if (socket.socketSessions.size >= 1) {
          log(`[ERROR] Socket already has a session, closing existing session(s)`);
          socket.socketSessions.forEach(existingSessionId => {
            try {
              terminalManager.closeSession(existingSessionId);
              log(`[SESSION] Closed existing session ${existingSessionId} on new create request`);
            } catch (error) {
              logError(`[ERROR] Failed to close existing session ${existingSessionId}: ${error.message}`);
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
            log(`[RESPONSE] session_timeout_warning to ${userId} for ${sessionId}`);
            socket.emit('session_timeout_warning', { sessionId, remainingTime: 30 });
          } else if (action === 'close') {
            socket.socketSessions.delete(sessionId);
            socket.emit('session_closed', { sessionId });
            log(`[RESPONSE] session_closed to ${userId} for ${sessionId} (timeout)`);
            log(`[SESSION] ${sessionId} timeout closed`);
          }
        };

        const session = terminalManager.createSession(userId, sessionCallback);
        socket.socketSessions.add(session.id);

        session.pty.onData((data) => {
          log(`[RESPONSE] output_data to ${userId} from ${session.id}: ${data.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}`);
          socket.emit('output_data', {
            sessionId: session.id,
            data: data
          });
        });

        socket.emit('session_created', {
          sessionId: session.id,
          stats: terminalManager.getStats()
        });

        log(`[RESPONSE] session_created to ${userId} with ${session.id}`);
        log(`[SESSION] ${session.id} created by ${userId}`);

      } catch (error) {
        logError(`[ERROR] Failed to create session: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('input_command', ({ sessionId, command }) => {
      try {
        const session = terminalManager.getSession(sessionId);
        if (!session || session.closed) {
          logError(`[ERROR] Invalid or closed session: ${sessionId}`);
          socket.emit('error', { message: 'Invalid or closed session' });
          return;
        }

        const displayData = command.charCodeAt(0) < 32 || command.charCodeAt(0) > 126
          ? `\\x${command.charCodeAt(0).toString(16)}`
          : command;
        log(`[REQUEST] input_command from ${userId} for ${sessionId}: ${displayData}`);
        terminalManager.write(sessionId, command);
      } catch (error) {
        logError(`[ERROR] input_command failed: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });
    
    socket.on('acknowledge_warning', ({ sessionId }) => {
      try {
        const session = terminalManager.getSession(sessionId);
        if (!session || session.closed) {
          logError(`[ERROR] Invalid or closed session: ${sessionId}`);
          socket.emit('error', { message: 'Invalid or closed session' });
          return;
        }

        log(`[REQUEST] acknowledge_warning from ${userId} for ${sessionId}`);
        terminalManager.acknowledgeWarning(sessionId);
        socket.emit('warning_acknowledged', { sessionId });
        log(`[RESPONSE] warning_acknowledged to ${userId} for ${sessionId}`);
      } catch (error) {
        logError(`[ERROR] acknowledge_warning failed: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('resize', ({ sessionId, cols, rows }) => {
      try {
        const session = terminalManager.getSession(sessionId);
        if (!session || session.closed) {
          logError(`[ERROR] Invalid or closed session: ${sessionId}`);
          socket.emit('error', { message: 'Invalid or closed session' });
          return;
        }

        log(`[REQUEST] resize from ${userId} for ${sessionId}: ${cols}x${rows}`);
        terminalManager.resize(sessionId, cols, rows);
        log(`[RESPONSE] resize acknowledged for ${sessionId}`);
      } catch (error) {
        logError(`[ERROR] resize failed: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('close_session', ({ sessionId }) => {
      try {
        const session = terminalManager.getSession(sessionId);
        if (!session || session.closed) {
          log(`[REQUEST] close_session for already closed session: ${sessionId}`);
          socket.socketSessions.delete(sessionId);
          return;
        }

        log(`[REQUEST] close_session from ${userId} for ${sessionId}`);
        terminalManager.closeSession(sessionId);
        socket.socketSessions.delete(sessionId);
        socket.emit('session_closed', { sessionId });
        log(`[RESPONSE] session_closed to ${userId} for ${sessionId}`);
        log(`[SESSION] ${sessionId} closed by ${userId}`);
      } catch (error) {
        logError(`[ERROR] close_session failed: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('list_sessions', () => {
      try {
        log(`[REQUEST] list_sessions from ${userId}`);
        const sessions = terminalManager.getUserSessions(userId);
        const sessionList = sessions.map(s => ({
          id: s.id,
          createdAt: s.createdAt
        }));
        socket.emit('sessions_list', sessionList);
        log(`[RESPONSE] sessions_list to ${userId}: ${sessionList.length} sessions`);
      } catch (error) {
        logError(`[ERROR] list_sessions failed: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('disconnect', () => {
      try {
        log(`[SOCKET] ${userId} disconnected, closing ${socket.socketSessions.size} sessions`);
        const sessionIds = Array.from(socket.socketSessions);
        socket.socketSessions.clear();

        sessionIds.forEach(sessionId => {
          try {
            const session = terminalManager.getSession(sessionId);
            if (session && !session.closed) {
              terminalManager.closeSession(sessionId);
            }
          } catch (error) {
            logError(`[ERROR] Failed to close session ${sessionId}: ${error.message}`);
          }
        });
      } catch (error) {
        logError(`[ERROR] disconnect handler failed: ${error.message}`);
      }
    });

    socket.emit('connected', { userId });
  });
}

module.exports = { setupSocket };
