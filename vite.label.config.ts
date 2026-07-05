import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Separate, local-dev-only build for the puyoquess labeling UI (`label.html`).
// Kept fully independent from `vite.config.ts` / `npm run build` so the
// public GitHub Pages build (`dist`) never picks up labeler code:
// - different root entry (`label.html` instead of `index.html`)
// - different build output dir (`dist-label` instead of `dist`)
//
// `base` MUST match the public app (`vite.config.ts` base '/puyomist') so the
// reused board components resolve their asset paths. The puyo sprite is
// referenced by a hardcoded absolute path (`/puyomist/assets/puyo-sprite.svg`
// in symbol-reference.ts); under any other base that URL 404s and the board
// renders with invisible puyos. Matching the base makes the labeler's asset
// environment identical to the public app without touching shared code.
// Consequence: open the labeler at `http://localhost:5173/puyomist/label.html`.
//
// https://vitejs.dev/config/
export default defineConfig({
  base: '/puyomist/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve('./src'),
      $cursors: resolve('./public/assets/cursors')
    }
  },
  build: {
    outDir: 'dist-label',
    rollupOptions: {
      input: resolve('./label.html')
    }
  },
  server: {
    watch: {
      usePolling: true
    }
  }
});
