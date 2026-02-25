import { useState, useEffect } from 'react';
import Auth from './Auth';
import Terminal from './Terminal';
import SimpleCommand from './SimpleCommand';
import websocket from '../services/websocket';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('terminal');
  const [sessionId, setSessionId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (token && username) {
      setUser(username);
      connectWebSocket(token);
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
      websocket.off('sessionCreated');
      websocket.off('sessionClosed');
      websocket.off('error');
    };
  }, []);

  const connectWebSocket = async (token) => {
    try {
      await websocket.connect(token);
    } catch (err) {
      setError('Failed to connect to server');
    }
  };

  const handleLogin = (username) => {
    setUser(username);
    const token = localStorage.getItem('token');
    connectWebSocket(token);
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

  const handleOutput = (data) => {
    console.log('Output:', data);
  };

  const handleCloseSession = () => {
    if (sessionId) {
      websocket.closeSession(sessionId);
    }
    setSessionId(null);
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Web Terminal</h1>
        <div className="user-info">
          <span>{user}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="app-content">
        <div className="sidebar">
          <div className="connection-status">
            <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
              {connected ? '● Connected' : '○ Disconnected'}
            </span>
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
