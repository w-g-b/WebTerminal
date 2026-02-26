import { useState, useEffect, useCallback } from 'react';
import Auth from './Auth';
import Terminal from './Terminal';
import SimpleCommand from './SimpleCommand';
import websocket from '../services/websocket';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('simple');
  const [sessionId, setSessionId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [autoConnected, setAutoConnected] = useState(false);
  const [error, setError] = useState('');
  const [transportMode, setTransportMode] = useState('polling');
  const [sidebarVisible, setSidebarVisible] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (token && username) {
      setUser(username);
    }

    return () => {
      websocket.disconnect();
    };
  }, []);

  useEffect(() => {
    websocket.on('connected', () => {
      setConnected(true);
      setError('');
    });

    websocket.on('disconnect', () => {
      setConnected(false);
    });

    websocket.on('sessionCreated', (data) => {
      setSessionId(data.sessionId);
    });

    websocket.on('sessionClosed', () => {
      setSessionId(null);
    });

    websocket.on('error', (data) => {
      setError(data.message);
    });

    return () => {
      websocket.off('connected');
      websocket.off('disconnect');
      websocket.off('sessionCreated');
      websocket.off('sessionClosed');
      websocket.off('error');
    };
  }, []);

  const connectWebSocket = async (token, mode = transportMode) => {
    try {
      await websocket.connect(token, mode);
    } catch (err) {
      setError('Failed to connect to server');
    }
  };

  const switchTransport = async (mode) => {
    websocket.disconnect();
    setConnected(false);
    setTransportMode(mode);
  };

  const handleLogin = (username) => {
    setUser(username);
  };

  const handleConnect = async () => {
    if (connected) {
      websocket.disconnect();
      setConnected(false);
      setAutoConnected(false);
    } else {
      const token = localStorage.getItem('token');
      try {
        await connectWebSocket(token);
        setAutoConnected(true);
      } catch (err) {
        setError('Failed to connect to server');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
    setSessionId(null);
    websocket.disconnect();
  };

  const handleCreateSession = () => {
    websocket.createSession();
  };

  const handleOutput = useCallback((id, data) => {
    websocket.sendCommand(id, data);
  }, []);

  const handleCloseSession = useCallback(() => {
    if (sessionId) {
      websocket.closeSession(sessionId);
    }
    setSessionId(null);
  }, [sessionId]);

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button className="toggle-sidebar" onClick={() => setSidebarVisible(!sidebarVisible)}>
            {sidebarVisible ? '◀' : '▶'}
          </button>
          <h1>Web Terminal</h1>
        </div>
        <div className="user-info">
          <span>{user}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="app-content">
        <div className={`sidebar ${sidebarVisible ? 'visible' : 'hidden'}`}>
          <div className="connection-status">
            <div className="status-display">
              <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}></span>
              <span className="status-text">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <button 
              className={`connection-btn ${connected ? 'disconnect' : 'connect'}`}
              onClick={handleConnect}
            >
              {connected ? 'Disconnect' : 'Connect'}
            </button>
            <span className="transport-mode">
              ({transportMode === 'websocket' ? 'WebSocket' : 'Polling'})
            </span>
          </div>

          <div className="transport-selector">
            <h3>Transport</h3>
            <button
              className={transportMode === 'websocket' ? 'active' : ''}
              onClick={() => switchTransport('websocket')}
            >
              WebSocket
            </button>
            <button
              className={transportMode === 'polling' ? 'active' : ''}
              onClick={() => switchTransport('polling')}
            >
              Polling
            </button>
          </div>

          <div className="mode-selector">
            <h3>Mode</h3>
            <button
              className={mode === 'terminal' ? 'active' : ''}
              onClick={() => setMode('terminal')}
            >
              Terminal
            </button>
            <button
              className={mode === 'simple' ? 'active' : ''}
              onClick={() => setMode('simple')}
            >
              Simple
            </button>
          </div>

          <div className="session-controls">
            <h3>Session</h3>
            {!sessionId ? (
              <button onClick={handleCreateSession}>New Session</button>
            ) : (
              <button onClick={handleCloseSession}>Close Session</button>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError('')}>×</button>
            </div>
          )}
        </div>

        <main className="main-content">
          {sessionId ? (
            mode === 'terminal' ? (
              <Terminal
                sessionId={sessionId}
                onClose={handleCloseSession}
                onOutput={(id, data) => websocket.sendCommand(id, data)}
                connected={connected}
              />
            ) : (
              <SimpleCommand
                sessionId={sessionId}
                onClose={handleCloseSession}
                onOutput={(id, data) => websocket.sendCommand(id, data)}
              />
            )
          ) : (
            <div className="no-session">
              <h2>No Active Session</h2>
              <p>Create a new session to start executing commands.</p>
              <button onClick={handleCreateSession}>Create Session</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
