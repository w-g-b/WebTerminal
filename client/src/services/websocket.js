import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.heartbeatInterval = null;
    this.heartbeatTimeout = 30000;
    this.sessionIds = [];
  }

  connect(token, transportMode = 'websocket') {
    if (this.socket?.connected) {
      if (this.socket.io.opts.transports.includes(transportMode)) {
        return Promise.resolve();
      } else {
        this.disconnect();
      }
    }

    return new Promise((resolve, reject) => {
      this.socket = io('/', {
        auth: { token },
        transports: transportMode === 'websocket' ? ['websocket'] : ['polling'],
        reconnection: false,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 120000,
        forceNew: true,
        rememberUpgrade: false,
        upgrade: transportMode === 'websocket',
        query: { transport: transportMode },
        polling: {
          duration: 60000
        }
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.startHeartbeat();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        if (error.message && error.message.includes('token已失效')) {
          alert(error.message);
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          window.location.href = '/';
        }
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        this.stopHeartbeat();
        this.emit('disconnect');
      });

      this.socket.on('output_data', (data) => {
        console.log('Received output:', data);
        this.emit('output', data);
      });

      this.socket.on('session_created', (data) => {
        if (!this.sessionIds.includes(data.sessionId)) {
          this.sessionIds.push(data.sessionId);
        }
        this.emit('sessionCreated', data);
      });

      this.socket.on('session_closed', (data) => {
        console.log('[DEBUG] Received session_closed event:', data);
        const index = this.sessionIds.indexOf(data.sessionId);
        if (index > -1) {
          this.sessionIds.splice(index, 1);
        }
        this.emit('sessionClosed', data);
      });

      this.socket.on('sessions_list', (data) => {
        this.emit('sessionsList', data);
      });

      this.socket.on('error', (data) => {
        this.emit('error', data);
      });

      this.socket.on('connected', (data) => {
        this.emit('connected', data);
      });

      this.socket.on('session_timeout_warning', (data) => {
        console.log('[DEBUG] Received session_timeout_warning event:', data);
        this.emit('sessionTimeoutWarning', data);
      });
    });
  }

  disconnect() {
    this.stopHeartbeat();
    this.sessionIds = [];
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  createSession() {
    this.socket?.emit('create_session');
  }

  sendCommand(sessionId, command) {
    console.log('Sending command:', sessionId, command, command.charCodeAt(0));
    this.socket?.emit('input_command', { sessionId, command });
  }

  resize(sessionId, cols, rows) {
    this.socket?.emit('resize', { sessionId, cols, rows });
  }

  closeSession(sessionId) {
    console.log('[DEBUG] closeSession called for sessionId:', sessionId);
    this.socket?.emit('close_session', { sessionId });
  }

  closeAllSessions() {
    return new Promise((resolve) => {
      const sessionIds = this.sessionIds || [];
      if (sessionIds.length === 0) {
        resolve();
        return;
      }

      let closedCount = 0;
      const totalToClose = sessionIds.length;

      const handleSessionClosed = (data) => {
        closedCount++;
        if (closedCount >= totalToClose) {
          this.off('sessionClosed', handleSessionClosed);
          this.sessionIds = [];
          resolve();
        }
      };

      this.on('sessionClosed', handleSessionClosed);

      sessionIds.forEach(sessionId => {
        this.socket?.emit('close_session', { sessionId });
      });

      setTimeout(() => {
        this.off('sessionClosed', handleSessionClosed);
        resolve();
      }, 5000);
    });
  }

  acknowledgeWarning(sessionId) {
    this.socket?.emit('acknowledge_warning', { sessionId });
  }

  list() {
    this.socket?.emit('list_sessions');
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping', { timestamp: Date.now() });
      }
    }, this.heartbeatTimeout / 2);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export default new WebSocketService();
