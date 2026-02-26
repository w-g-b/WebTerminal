import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
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
        reconnection: true,
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
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
      });

      this.socket.on('output_data', (data) => {
        console.log('Received output:', data);
        this.emit('output', data);
      });

      this.socket.on('session_created', (data) => {
        this.emit('sessionCreated', data);
      });

      this.socket.on('session_closed', (data) => {
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
    });
  }

  disconnect() {
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
    this.socket?.emit('close_session', { sessionId });
  }

  listSessions() {
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
}

export default new WebSocketService();
