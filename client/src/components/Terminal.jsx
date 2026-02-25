import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import websocket from '../services/websocket';
import './Terminal.css';

export default function Terminal({ sessionId, onClose, onOutput }) {
  const terminalRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);

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
      }
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    terminal.onData((data) => {
      onOutput(sessionId, data);
    });

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      terminal.dispose();
    };
  }, [sessionId, onOutput]);

  useEffect(() => {
    const handleOutput = (data) => {
      if (data.sessionId === sessionId && terminalInstanceRef.current) {
        terminalInstanceRef.current.write(data.data);
      }
    };

    websocket.on('output', handleOutput);

    return () => {
      websocket.off('output', handleOutput);
    };
  }, [sessionId]);

  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span>Terminal</span>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="terminal" ref={terminalRef}></div>
    </div>
  );
}
