const pty = require('node-pty');
const os = require('os');
require('../utils/config');
const logger = require('./utils/logger');

const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || '10');
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT || '300000');

class TerminalManager {
  constructor() {
    this.sessions = new Map();
    this.sessionCount = 0;
  }

  createSession(userId, callback) {
    if (this.sessionCount >= MAX_SESSIONS) {
      throw new Error('Maximum sessions reached');
    }

    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    const cwd = process.env.HOME || process.cwd();

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: process.env
    });

    const sessionId = `${userId}-${Date.now()}`;
    const session = {
      id: sessionId,
      userId,
      pty: ptyProcess,
      createdAt: Date.now(),
      callback: callback,
      timeout: null,
      warningTimeout: null,
      closed: false
    };

    const WARNING_BEFORE_CLOSE = 30000;

    session.warningTimeout = setTimeout(() => {
      if (!session.closed && session.callback) {
        session.callback(sessionId, 'warning');
      }
    }, SESSION_TIMEOUT - WARNING_BEFORE_CLOSE);

    session.timeout = setTimeout(() => {
      this.closeSession(sessionId);
    }, SESSION_TIMEOUT);

    this.sessions.set(sessionId, session);
    this.sessionCount++;

    ptyProcess.on('exit', () => {
      this.closeSession(sessionId);
    });

    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  write(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (session && !session.closed) {
      session.pty.write(data);
      this.refreshTimeout(sessionId);
    }
  }

  resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (session && !session.closed) {
      session.pty.resize(cols, rows);
      this.refreshTimeout(sessionId);
    }
  }

  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && !session.closed) {
      session.closed = true;
      clearTimeout(session.timeout);
      clearTimeout(session.warningTimeout);
      session.callback = null;
      session.pty.destroy();
      this.sessions.delete(sessionId);
      this.sessionCount--;
    }
  }

  refreshTimeout(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && !session.closed) {
      clearTimeout(session.timeout);
      clearTimeout(session.warningTimeout);
      
      const WARNING_BEFORE_CLOSE = 30000;
      
      session.warningTimeout = setTimeout(() => {
        if (!session.closed && session.callback) {
          session.callback(sessionId, 'warning');
        }
      }, SESSION_TIMEOUT - WARNING_BEFORE_CLOSE);
      
      session.timeout = setTimeout(() => {
        this.closeSession(sessionId);
      }, SESSION_TIMEOUT);
    }
  }
  
  acknowledgeWarning(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && !session.closed) {
      clearTimeout(session.timeout);
      clearTimeout(session.warningTimeout);

      session.warningTimeout = setTimeout(() => {
        if (!session.closed && session.callback) {
          session.callback(sessionId, 'warning');
        }
      }, SESSION_TIMEOUT - 30000);

      session.timeout = setTimeout(() => {
        this.closeSession(sessionId);
      }, SESSION_TIMEOUT);
    }
  }

  keepAlive(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && !session.closed) {
      clearTimeout(session.timeout);
      clearTimeout(session.warningTimeout);

      session.warningTimeout = setTimeout(() => {
        if (!session.closed && session.callback) {
          session.callback(sessionId, 'warning');
        }
      }, SESSION_TIMEOUT - 30000);

      session.timeout = setTimeout(() => {
        this.closeSession(sessionId);
      }, SESSION_TIMEOUT);
    }
  }

  getUserSessions(userId) {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }

  closeUserSessions(userId) {
    const sessions = this.getUserSessions(userId);
    sessions.forEach(session => this.closeSession(session.id));
  }

  getStats() {
    return {
      totalSessions: this.sessionCount,
      maxSessions: MAX_SESSIONS
    };
  }
}

module.exports = new TerminalManager();
