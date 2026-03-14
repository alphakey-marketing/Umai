import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
  },
  build: {
    // Main app bundle: esnext so modern syntax is preserved.
    target: 'esnext',
  },
  worker: {
    // Worker bundle: ES module format, esnext target.
    // This tells esbuild NOT to transform BigInt literals (1n) that exist
    // inside @xenova/transformers — they are left as native BigInt which
    // every browser that supports WebAssembly (required by the model) also
    // supports natively.
    format: 'es',
    plugins: () => [],
    rollupOptions: {
      output: {
        format: 'es',
      },
    },
  },
  optimizeDeps: {
    // Exclude from Vite's dep pre-bundler (dev only) so esbuild doesn't
    // stumble on @xenova/transformers during the optimisation step.
    // The worker bundling at build time goes through Rollup, not this step.
    exclude: ['@xenova/transformers'],
  },
  esbuild: {
    // Main thread esbuild: esnext so BigInt in any shared code is fine.
    target: 'esnext',
  },
});
