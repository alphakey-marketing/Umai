/**
 * vite.config.ts
 *
 * ============================================================
 * CRITICAL ARCHITECTURE — READ BEFORE MODIFYING
 * ============================================================
 *
 * KEEP THIS CONFIG MINIMAL. The transcription worker breaks if
 * you add worker-related options. Specifically:
 *
 * - DO NOT add worker.format = 'es' or 'iife'.
 *   Vite already handles module workers correctly without this.
 *   Adding it changes how the worker chunk is emitted and breaks
 *   the dynamic import() inside transcribeWorker.ts.
 *
 * - DO NOT add rollupOptions.external for @xenova/transformers.
 *   The library is intentionally NOT bundled (loaded from CDN at
 *   runtime via dynamic import). Making it external at the Rollup
 *   level causes a different code path that breaks in production.
 *
 * - optimizeDeps.exclude for @xenova/transformers MUST stay.
 *   Without it, Vite's pre-bundler tries to process the package
 *   during dev startup and crashes on BigInt literals.
 *
 * - build.target: 'esnext' is NOT needed here (the worker itself
 *   never goes through esbuild since the library is CDN-loaded).
 *   Leave the build target at Vite's default.
 *
 * LAST CONFIRMED WORKING: commit 4a3fefac (March 14 2026)
 * ============================================================
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
  },
  optimizeDeps: {
    // Exclude @xenova/transformers from Vite pre-bundling.
    // The library is loaded at runtime from CDN inside the worker.
    // Pre-bundling it would crash on BigInt literals in esbuild.
    exclude: ['@xenova/transformers'],
  },
});
