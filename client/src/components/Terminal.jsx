import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import websocket from '../services/websocket';
import './Terminal.css';

function stripAnsi(str) {
  let result = str;
  
  const ansiPatterns = [
    /\x1b\[[0-9;]*m/g,
    /\x1b\[[0-9]*;[0-9]*;[0-9]*m/g,
    /\x1b\[[0-9]*;[0-9]*m/g,
    /\x1b\[[0-9]*[A-Za-z]/g,
    /\x1b\[[0-9]*;[0-9]*[A-Za-z]/g,
    /\x1b\[[0-9]*;[0-9]*;[0-9]*[A-Za-z]/g,
    /\x1b\[[?][0-9;]*[hl]/g,
    /\x1b\]0;[^\x07]*\x07/g,
    /\x07/g,
    /\[\?2004[hl]/g,
    /\]\0;.*?\x07/g
  ];
  
  ansiPatterns.forEach(pattern => {
    result = result.replace(pattern, '');
  });
  
  return result;
}

export default function Terminal({ sessionId, onClose, onOutput, connected, sessionActive }) {
  const terminalRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const defaultHeight = Math.floor(window.innerHeight * 0.8);
  const heightRef = useRef(defaultHeight);
  const [height, setHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);

  const sessionIdRef = useRef(sessionId);
  const onOutputRef = useRef(onOutput);
  const [simpleInput, setSimpleInput] = useState('');
  const [simpleOutput, setSimpleOutput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const simpleOutputRef = useRef(null);
  const [connectionTime, setConnectionTime] = useState(0);
  const connectionStartTimeRef = useRef(null);
  const timerRef = useRef(null);
  const accumulatedTimeRef = useRef(0);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);



  useEffect(() => {
    const isActive = connected && sessionActive;
    
    if (isActive) {
      if (!connectionStartTimeRef.current) {
        connectionStartTimeRef.current = Date.now();
      }
      
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - connectionStartTimeRef.current) / 1000);
        const currentTime = accumulatedTimeRef.current + elapsed;
        setConnectionTime(currentTime);
      }, 1000);
      
      return () => {
        clearInterval(timerRef.current);
      };
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (connectionStartTimeRef.current) {
        accumulatedTimeRef.current += Math.floor((Date.now() - connectionStartTimeRef.current) / 1000);
        connectionStartTimeRef.current = null;
      }
    }
  }, [connected, sessionActive]);

  useEffect(() => {
    onOutputRef.current = onOutput;
  }, [onOutput]);

  useEffect(() => {
    if (simpleOutputRef.current) {
      simpleOutputRef.current.scrollTop = simpleOutputRef.current.scrollHeight;
    }
  }, [simpleOutput]);

  useEffect(() => {
    if (!sessionId || !terminalRef.current) return;

    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Courier New, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff'
      },
      disableStdin: false,
      allowProposedApi: true
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    const cols = terminal.cols;
    const rows = terminal.rows;
    websocket.resize(sessionId, cols, rows);

    terminal.onData((data) => {
      onOutputRef.current(sessionId, data);
    });

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      terminal.dispose();
    };
  }, [sessionId]);

  useEffect(() => {
    const handleOutput = (data) => {
      if (data.sessionId === sessionIdRef.current) {
        if (terminalInstanceRef.current) {
          terminalInstanceRef.current.write(data.data);
        }
        const cleanData = stripAnsi(data.data);
        if (cleanData) {
          setSimpleOutput(prev => prev + cleanData);
        }
      }
    };

    websocket.on('output', handleOutput);

    return () => {
      websocket.off('output', handleOutput);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && terminalInstanceRef.current) {
        fitAddonRef.current.fit();
        const cols = terminalInstanceRef.current.cols;
        const rows = terminalInstanceRef.current.rows;
        websocket.resize(sessionIdRef.current, cols, rows);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const resizeHandle = resizeHandleRef.current;
    if (!resizeHandle) return;

    const handleMouseDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      const startY = e.clientY;
      const startHeight = heightRef.current;
      const container = resizeHandle.parentElement;

      const handleMouseMove = (e) => {
        e.preventDefault();
        const newHeight = startHeight + (e.clientY - startY);
        if (newHeight >= 200 && newHeight <= 2000) {
          heightRef.current = newHeight;
          container.style.height = `${newHeight}px`;
          if (fitAddonRef.current) {
            fitAddonRef.current.fit();
          }
        }
      };

      const handleMouseUp = (e) => {
        e.preventDefault();
        setIsResizing(false);
        setHeight(heightRef.current);
        if (fitAddonRef.current) {
          const cols = terminalInstanceRef.current.cols;
          const rows = terminalInstanceRef.current.rows;
          websocket.resize(sessionIdRef.current, cols, rows);
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    resizeHandle.addEventListener('mousedown', handleMouseDown);

    return () => {
      resizeHandle.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const handleSimpleSubmit = (e) => {
    e.preventDefault();
    if (!simpleInput.trim()) return;

    setHistory([...history, simpleInput]);
    setHistoryIndex(history.length);
    onOutputRef.current(sessionId, simpleInput + '\n');
    setSimpleInput('');
  };

  const handleSimpleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        setHistoryIndex(historyIndex - 1);
        setSimpleInput(history[historyIndex - 1]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        setHistoryIndex(historyIndex + 1);
        setSimpleInput(history[historyIndex + 1]);
      } else {
        setHistoryIndex(history.length);
        setSimpleInput('');
      }
    }
  };

  const clearSimpleOutput = () => {
    setSimpleOutput('');
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`terminal-container ${isResizing ? 'resizing' : ''}`} style={{ height: `${height}px` }}>
      <div className="terminal-header">
        <span>Terminal</span>
        <span className="connection-time">⏱ {formatTime(connectionTime)}</span>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="terminal" ref={terminalRef}></div>
      {!sessionActive && (
        <div className="session-status-warning">
          ⏰ 会话已超时关闭，历史记录可继续查看
        </div>
      )}

      <div className="simple-command-section">
        <form className="simple-input-area" onSubmit={handleSimpleSubmit}>
          <span className="prompt">$</span>
          <input
            type="text"
            value={simpleInput}
            onChange={(e) => setSimpleInput(e.target.value)}
            onKeyDown={handleSimpleKeyDown}
            placeholder="Type a command..."
            autoComplete="off"
          />
          <button type="submit">Run</button>
        </form>
      </div>
      <div 
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        ref={resizeHandleRef}
      ></div>
    </div>
  );
}
