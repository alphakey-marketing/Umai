import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
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
    // Still exclude from dep pre-bundling to avoid dev-time issues.
    exclude: ['@xenova/transformers'],
  },
});
