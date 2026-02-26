import { useState, useEffect, useRef } from 'react';
import websocket from '../services/websocket';
import './SimpleCommand.css';

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

export default function SimpleCommand({ sessionId, onClose, onOutput }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const heightRef = useRef(500);
  const [height, setHeight] = useState(500);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    const handleOutput = (data) => {
      if (data.sessionId === sessionId) {
        const cleanData = stripAnsi(data.data);
        if (cleanData) {
          setOutput(prev => prev + cleanData);
        }
      }
    };

    websocket.on('output', handleOutput);

    return () => {
      websocket.off('output', handleOutput);
    };
  }, [sessionId]);

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
        }
      };

      const handleMouseUp = (e) => {
        e.preventDefault();
        setIsResizing(false);
        setHeight(heightRef.current);
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
  }, [sessionId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setHistory([...history, input]);
    setHistoryIndex(history.length);
    onOutput(sessionId, input + '\n');
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        setHistoryIndex(historyIndex - 1);
        setInput(history[historyIndex - 1]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        setHistoryIndex(historyIndex + 1);
        setInput(history[historyIndex + 1]);
      } else {
        setHistoryIndex(history.length);
        setInput('');
      }
    }
  };

  const clearOutput = () => {
    setOutput('');
  };

  return (
    <div className={`simple-command-container ${isResizing ? 'resizing' : ''}`} style={{ height: `${height}px` }}>
      <div className="simple-command-header">
        <span>Command Input</span>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="output-area" ref={outputRef}>
        <pre>{output || 'Enter a command to execute...'}</pre>
      </div>
      <form className="input-area" onSubmit={handleSubmit}>
        <span className="prompt">$</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          autoComplete="off"
        />
        <button type="submit">Run</button>
        <button type="button" onClick={clearOutput}>Clear</button>
      </form>
      <div 
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        ref={resizeHandleRef}
      ></div>
    </div>
  );
}
