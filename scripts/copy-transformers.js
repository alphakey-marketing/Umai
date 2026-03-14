#!/usr/bin/env node
/**
 * Copies @xenova/transformers UMD bundle from node_modules into public/
 * so the classic Web Worker can load it via importScripts('/transformers.min.js')
 * without hitting any CDN or CSP restrictions.
 */
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src  = resolve(__dirname, '../node_modules/@xenova/transformers/dist/transformers.min.js');
const dest = resolve(__dirname, '../public/transformers.min.js');

if (!existsSync(src)) {
  console.error('[copy-transformers] Source not found:', src);
  process.exit(1);
}

mkdirSync(resolve(__dirname, '../public'), { recursive: true });
copyFileSync(src, dest);
console.log('[copy-transformers] Copied transformers.min.js -> public/transformers.min.js');
