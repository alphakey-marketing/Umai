import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: 'all',
  },
  optimizeDeps: {
    // Must exclude — @xenova/transformers loads WASM internally and
    // cannot be pre-bundled by Vite without breaking
    exclude: ['@xenova/transformers'],
  },
  worker: {
    // Must be 'es' — iife format breaks ES module imports inside workers
    format: 'es',
  },
});
