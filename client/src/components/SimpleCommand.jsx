import { useState, useEffect, useRef } from 'react';
import websocket from '../services/websocket';
import './SimpleCommand.css';

export default function SimpleCommand({ sessionId, onClose, onOutput }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    const handleOutput = (data) => {
      if (data.sessionId === sessionId) {
        setOutput(prev => prev + data.data);
      }
    };

    websocket.on('output', handleOutput);

    return () => {
      websocket.off('output', handleOutput);
    };
  }, [sessionId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setHistory([...history, input]);
    setHistoryIndex(history.length);
    setOutput(prev => prev + `$ ${input}\n`);
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
    <div className="simple-command-container">
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
    </div>
  );
}
