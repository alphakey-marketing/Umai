import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Exclude transformers.js from pre-bundling — it loads WASM internally
    exclude: ['@xenova/transformers'],
  },
  worker: {
    format: 'es',
  },
});
