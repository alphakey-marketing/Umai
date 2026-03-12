import type { SubtitleLine } from '../types';

/**
 * Parse a .srt file string into SubtitleLine[].
 *
 * SRT format per block:
 *   <index>
 *   HH:MM:SS,mmm --> HH:MM:SS,mmm
 *   <text line(s)>
 *   <blank line>
 */
export function parseSRT(raw: string): SubtitleLine[] {
  const lines: SubtitleLine[] = [];
  // Normalise line endings and split into blocks
  const blocks = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const parts = block.trim().split('\n');
    if (parts.length < 3) continue;

    const index     = parseInt(parts[0], 10);
    const timeLine  = parts[1];
    const textLines = parts.slice(2).join(' ').replace(/<[^>]*>/g, '').trim(); // strip HTML tags

    const times = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
    );
    if (!times || isNaN(index) || !textLines) continue;

    const start_ms = toMs(+times[1], +times[2], +times[3], +times[4]);
    const end_ms   = toMs(+times[5], +times[6], +times[7], +times[8]);

    lines.push({ index, start_ms, end_ms, text: textLines });
  }
  return lines;
}

function toMs(h: number, m: number, s: number, ms: number): number {
  return h * 3_600_000 + m * 60_000 + s * 1_000 + ms;
}

/** Parse a .vtt (WebVTT) file string into SubtitleLine[]. */
export function parseVTT(raw: string): SubtitleLine[] {
  const lines: SubtitleLine[] = [];
  const blocks = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split(/\n\s*\n/);
  let idx = 0;

  for (const block of blocks) {
    const parts = block.trim().split('\n');
    // Skip WEBVTT header or NOTE blocks
    if (parts[0].startsWith('WEBVTT') || parts[0].startsWith('NOTE')) continue;

    // Cue may start with an optional cue id line
    let timeLine = '';
    let textStart = 0;
    if (parts[0].includes('-->')) {
      timeLine  = parts[0];
      textStart = 1;
    } else if (parts.length > 1 && parts[1].includes('-->')) {
      timeLine  = parts[1];
      textStart = 2;
    } else continue;

    const textLines = parts.slice(textStart).join(' ').replace(/<[^>]*>/g, '').trim();
    const times = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/
    );
    if (!times || !textLines) continue;

    idx++;
    lines.push({
      index: idx,
      start_ms: toMs(+times[1], +times[2], +times[3], +times[4]),
      end_ms:   toMs(+times[5], +times[6], +times[7], +times[8]),
      text: textLines,
    });
  }
  return lines;
}

/** Auto-detect SRT vs VTT from file content and parse. */
export function parseSubtitleFile(raw: string): SubtitleLine[] {
  if (raw.trimStart().startsWith('WEBVTT')) return parseVTT(raw);
  return parseSRT(raw);
}

/** Get the active subtitle line for a given playback time in ms. */
export function getActiveLine(
  lines: SubtitleLine[],
  currentMs: number
): SubtitleLine | null {
  return lines.find(l => currentMs >= l.start_ms && currentMs <= l.end_ms) ?? null;
}

/** Get the index of the active line (for scrolling / navigation). */
export function getActiveIndex(
  lines: SubtitleLine[],
  currentMs: number
): number {
  return lines.findIndex(l => currentMs >= l.start_ms && currentMs <= l.end_ms);
}
