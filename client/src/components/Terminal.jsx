import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import websocket from '../services/websocket';
import './Terminal.css';

export default function Terminal({ sessionId, onClose, onOutput }) {
  const terminalRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const heightRef = useRef(500);
  const [height, setHeight] = useState(500);
  const [isResizing, setIsResizing] = useState(false);

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
      if (fitAddonRef.current && terminalInstanceRef.current) {
        fitAddonRef.current.fit();
        const cols = terminalInstanceRef.current.cols;
        const rows = terminalInstanceRef.current.rows;
        websocket.resize(sessionId, cols, rows);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
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
        if (newHeight >= 200 && newHeight <= 800) {
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
          websocket.resize(sessionId, cols, rows);
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
  }, [sessionId]);

  return (
    <div className={`terminal-container ${isResizing ? 'resizing' : ''}`} style={{ height: `${height}px` }}>
      <div className="terminal-header">
        <span>Terminal</span>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="terminal" ref={terminalRef}></div>
      <div 
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        ref={resizeHandleRef}
      ></div>
    </div>
  );
}
