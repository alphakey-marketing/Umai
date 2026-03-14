import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
  },
  build: {
    // esnext target for the main app bundle.
    // The worker (public/transcribeWorker.js) is a static asset and is
    // never processed by esbuild, so BigInt in @xenova/transformers is
    // never a build-time concern.
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
});
