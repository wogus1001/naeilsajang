import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const authServerPort = env.TOSS_AUTH_SERVER_PORT || '8787';
  const authServerTarget = `http://127.0.0.1:${authServerPort}`;

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api/auth/toss': {
          target: authServerTarget,
          changeOrigin: true,
        },
        '/api/store': {
          target: authServerTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      proxy: {
        '/api/auth/toss': {
          target: authServerTarget,
          changeOrigin: true,
        },
        '/api/store': {
          target: authServerTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
