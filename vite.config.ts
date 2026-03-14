import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

/**
 * Vite plugin: copies @xenova/transformers UMD bundle from node_modules
 * into public/ (dev) and dist/ (build) so the classic Web Worker can load
 * it via importScripts('/transformers.min.js') — same-origin, never CSP-blocked.
 */
function copyTransformers() {
  const src = resolve(
    __dirname,
    'node_modules/@xenova/transformers/dist/transformers.min.js'
  );

  return {
    name: 'copy-transformers',

    // Runs before dev server starts
    configResolved() {
      const dest = resolve(__dirname, 'public/transformers.min.js');
      if (existsSync(src)) {
        mkdirSync(resolve(__dirname, 'public'), { recursive: true });
        copyFileSync(src, dest);
        console.log('[copy-transformers] -> public/transformers.min.js');
      } else {
        console.warn('[copy-transformers] Source not found:', src);
      }
    },

    // Runs after production build writes files
    writeBundle() {
      const dest = resolve(__dirname, 'dist/transformers.min.js');
      if (existsSync(src)) {
        copyFileSync(src, dest);
        console.log('[copy-transformers] -> dist/transformers.min.js');
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyTransformers()],
  server: {
    host: '0.0.0.0',
  },
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
});
