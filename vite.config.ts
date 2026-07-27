import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // 末尾のスラッシュは必須。無いと import.meta.env.BASE_URL がそのまま '/puyomist'
  // になり、連結した URL が '/puyomistassets/...' に潰れる。
  base: '/puyomist/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve('./src'),
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
