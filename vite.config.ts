import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      // Never bundle @xenova/transformers — it is loaded at runtime
      // via importScripts() inside the worker, so Rollup must not
      // attempt to resolve or transform it (avoids BigInt issues).
      external: ['@xenova/transformers'],
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
});
