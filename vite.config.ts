import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
  },
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        format: 'es',
      },
    },
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
  esbuild: {
    target: 'esnext',
  },
});
