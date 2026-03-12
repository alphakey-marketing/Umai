import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@xenova/transformers', '@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  worker: {
    format: 'es',
  },
  // NO Cross-Origin-Embedder-Policy here — that header breaks cross-origin
  // resources (fonts, CDN assets). ffmpeg single-thread core does not need
  // SharedArrayBuffer so COOP/COEP are not required.
});
