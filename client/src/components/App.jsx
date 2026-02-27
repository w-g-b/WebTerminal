import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [autoConnected, setAutoConnected] = useState(false);
  const [error, setError] = useState('');
  const [transportMode, setTransportMode] = useState('polling');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [timeoutWarning, setTimeoutWarning] = useState(null);
  const [sessionDisconnectedWarning, setSessionDisconnectedWarning] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const userInitiatedCloseRef = useRef(false);

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
      setSessionDisconnectedWarning(false);
    });

    websocket.on('disconnect', () => {
      setConnected(false);
      if (sessionId) {
        setSessionDisconnectedWarning(true);
      }
    });

    websocket.on('sessionCreated', (data) => {
      setSessionId(data.sessionId);
      setSessionActive(true);
    });

    websocket.on('sessionClosed', (data) => {
      console.log('[DEBUG] App received sessionClosed:', data, 'userInitiatedClose:', userInitiatedCloseRef.current);
      setSessionActive(false);
      userInitiatedCloseRef.current = false;
    });

    websocket.on('session_timeout_warning', (data) => {
      console.log('[DEBUG] App received session_timeout_warning:', data);
      setTimeoutWarning(data);
    });

    websocket.on('error', (data) => {
      setError(data.message);
    });

    return () => {
      websocket.off('connected');
      websocket.off('disconnect');
      websocket.off('sessionCreated');
      websocket.off('sessionClosed');
      websocket.off('session_timeout_warning');
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
    if (connected) {
      const confirmed = window.confirm('已有连接存在，确认断开并切换传输方式？');
      if (!confirmed) {
        return;
      }
    }
    if (sessionId) {
      websocket.closeSession(sessionId);
      setSessionId(null);
    }
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

  const handleTimeoutWarning = (action) => {
    if (action === 'continue') {
      websocket.acknowledgeWarning(timeoutWarning.sessionId);
      setTimeoutWarning(null);
    } else if (action === 'close') {
      setSessionId(null);
      setSessionActive(true);
      setTimeoutWarning(null);
    }
  };

  const handleSessionDisconnected = () => {
    setSessionDisconnectedWarning(false);
  };

  const handleCreateSession = () => {
    if (!connected) {
      setError('Please connect to server first');
      return;
    }
    if (sessionId && !sessionActive) {
      setSessionId(null);
      setSessionActive(true);
    }
    websocket.createSession();
  };

  const handleOutput = useCallback((id, data) => {
    websocket.sendCommand(id, data);
  }, []);

  const handleCloseSession = useCallback(() => {
    if (sessionId) {
      userInitiatedCloseRef.current = true;
      websocket.closeSession(sessionId);
    }
    setSessionId(null);
    setSessionActive(true);
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

        {timeoutWarning && (
          <div className="timeout-warning-overlay">
            <div className="timeout-warning-modal">
              <h2>⏰ 会话即将超时</h2>
              <p>您的终端会话将在 {timeoutWarning.remainingTime} 秒后关闭</p>
              <div className="timeout-warning-actions">
                <button className="btn-continue" onClick={() => handleTimeoutWarning('continue')}>
                  继续使用
                </button>
                <button className="btn-close" onClick={() => handleTimeoutWarning('close')}>
                  关闭会话
                </button>
              </div>
            </div>
          </div>
        )}

        {sessionDisconnectedWarning && (
          <div className="session-disconnect-overlay">
            <div className="session-disconnect-modal">
              <h2>⚠️ 连接已断开</h2>
              <p>您的终端会话已断开连接，系统将自动尝试重连</p>
              <div className="session-disconnect-actions">
                <button className="btn-acknowledge" onClick={handleSessionDisconnected}>
                  我知道了
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="main-content">
          {sessionId ? (
            mode === 'terminal' ? (
              <Terminal
                sessionId={sessionId}
                onClose={handleCloseSession}
                onOutput={(id, data) => websocket.sendCommand(id, data)}
                connected={connected}
                sessionActive={sessionActive}
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
