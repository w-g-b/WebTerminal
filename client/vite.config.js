import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'));
  
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: parseInt(env.VITE_CLIENT_PORT) || 3000,
      open: false,
      proxy: {
        '/api': {
          target: env.VITE_SERVER_URL || 'http://localhost:8080',
          changeOrigin: true
        },
        '/socket.io': {
          target: env.VITE_SERVER_URL || 'http://localhost:8080',
          ws: true,
          changeOrigin: true
        }
      }
    }
  };
});