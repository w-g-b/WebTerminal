const pty = require('node-pty');
const os = require('os');
require('dotenv').config();

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
      warningTimeout: null
    };

    const WARNING_BEFORE_CLOSE = 30000;

    session.warningTimeout = setTimeout(() => {
      console.log(`[DEBUG] Warning timeout triggered for session ${sessionId}`);
      if (session.callback) {
        session.callback(sessionId, 'warning');
      }
    }, SESSION_TIMEOUT - WARNING_BEFORE_CLOSE);

    session.timeout = setTimeout(() => {
      console.log(`[DEBUG] Final timeout triggered for session ${sessionId}`);
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
    if (session) {
      session.pty.write(data);
      this.refreshTimeout(sessionId);
    }
  }

  resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.resize(cols, rows);
      this.refreshTimeout(sessionId);
    }
  }

  closeSession(sessionId) {
    console.log(`[DEBUG] closeSession called for sessionId: ${sessionId}`);
    const session = this.sessions.get(sessionId);
    if (session) {
      clearTimeout(session.timeout);
      clearTimeout(session.warningTimeout);
      console.log(`[DEBUG] Session found, timeout and warning timeout cleared. Calling callback if exists.`);
      
      if (session.callback) {
        console.log(`[DEBUG] Callback exists, executing...`);
        session.callback(sessionId, 'close');
      } else {
        console.log(`[DEBUG] No callback found for session ${sessionId}`);
      }
      
      session.pty.destroy();
      this.sessions.delete(sessionId);
      this.sessionCount--;
      console.log(`[DEBUG] Session ${sessionId} destroyed and removed. Remaining sessions: ${this.sessionCount}`);
    } else {
      console.log(`[DEBUG] Session ${sessionId} not found in sessions map`);
    }
  }

  refreshTimeout(sessionId) {
    console.log(`[DEBUG] refreshTimeout called for sessionId: ${sessionId}`);
    const session = this.sessions.get(sessionId);
    if (session) {
      clearTimeout(session.timeout);
      clearTimeout(session.warningTimeout);
      
      const WARNING_BEFORE_CLOSE = 30000;
      
      session.warningTimeout = setTimeout(() => {
        console.log(`[DEBUG] Warning timeout triggered for session ${sessionId}`);
        if (session.callback) {
          session.callback(sessionId, 'warning');
        }
      }, SESSION_TIMEOUT - WARNING_BEFORE_CLOSE);
      
      session.timeout = setTimeout(() => {
        console.log(`[DEBUG] Final timeout triggered for session ${sessionId}`);
        this.closeSession(sessionId);
      }, SESSION_TIMEOUT);
      
      console.log(`[DEBUG] Timers refreshed for session ${sessionId}`);
    }
  }
  
  acknowledgeWarning(sessionId) {
    console.log(`[DEBUG] acknowledgeWarning called for sessionId: ${sessionId}`);
    const session = this.sessions.get(sessionId);
    if (session) {
      clearTimeout(session.timeout);
      clearTimeout(session.warningTimeout);
      
      session.warningTimeout = setTimeout(() => {
        console.log(`[DEBUG] Warning timeout triggered for session ${sessionId}`);
        if (session.callback) {
          session.callback(sessionId, 'warning');
        }
      }, SESSION_TIMEOUT - 30000);
      
      session.timeout = setTimeout(() => {
        console.log(`[DEBUG] Final timeout triggered for session ${sessionId}`);
        this.closeSession(sessionId);
      }, SESSION_TIMEOUT);
      
      console.log(`[DEBUG] Timers refreshed for session ${sessionId}`);
    }
  }
  
  keepAlive(sessionId) {
    console.log(`[DEBUG] keepAlive called for sessionId: ${sessionId}`);
    const session = this.sessions.get(sessionId);
    if (session) {
      clearTimeout(session.timeout);
      clearTimeout(session.warningTimeout);
      
      session.warningTimeout = setTimeout(() => {
        console.log(`[DEBUG] Warning timeout triggered for session ${sessionId}`);
        if (session.callback) {
          session.callback(sessionId, 'warning');
        }
      }, SESSION_TIMEOUT - WARNING_TIMEOUT);
      
      session.timeout = setTimeout(() => {
        console.log(`[DEBUG] Final timeout triggered for session ${sessionId}`);
        this.closeSession(sessionId);
      }, SESSION_TIMEOUT);
      
      console.log(`[DEBUG] Timers refreshed for session ${sessionId}`);
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
