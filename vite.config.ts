import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { qwenProcessControllerPlugin } from './src/server/qwenProcessController';

export default defineConfig({
  plugins: [react(), qwenProcessControllerPlugin()],
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/testSetup.ts'],
  },
});
