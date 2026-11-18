import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readAppConfig } from './src/shared/config/appConfig.js';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build')
    readAppConfig({
      PROD: true,
      VITE_BACKEND_BASE_URL: env.VITE_BACKEND_BASE_URL,
      VITE_API_TIMEOUT_MS: env.VITE_API_TIMEOUT_MS,
    });

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_SERVER_PORT) || 5173,
      strictPort: true,
    },
  };
});
