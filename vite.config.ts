import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/puyomist',
  plugins: [react()],
  resolve: {
    alias: {
      $cursors: resolve('./public/assets/cursors')
    }
  },
  build: {
    chunkSizeWarningLimit: 1024
  },
  server: {
    watch: {
      usePolling: true
    }
  }
});
