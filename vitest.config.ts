import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      $cursors: resolve(__dirname, './public/assets/cursors')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // The WASM solver spec is heavy; v8 coverage instrumentation slows it well
    // past the 5s default, so allow extra head-room.
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: [
        'src/logics/**',
        'src/store/**',
        'src/components/ui/**',
        'src/components/controls/**',
        'src/components/result/**',
        'src/components/layout/**',
        'src/components/panels/**'
      ],
      exclude: [
        // SVG board rendering (covered by Storybook / manual E2E)
        'src/components/board/**',
        // WASM / comlink worker boundary + worker orchestration
        '**/*worker*',
        'src/store/internal/solve.ts',
        'src/store/actions/solve.ts',
        'src/store/actions/screenshot.ts',
        // Screenshot image-recognition boundary (canvas getImageData, manual E2E)
        'src/logics/board-detection.ts',
        'src/main.tsx',
        '**/*.stories.tsx'
      ],
      thresholds: {
        statements: 90,
        lines: 90,
        // Current actuals captured to prevent regression without forcing an
        // immediate spike; the plan's 90% target applies to statements/lines.
        branches: 80,
        functions: 88
      }
    }
  }
});
