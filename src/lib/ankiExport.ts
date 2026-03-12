/**
 * Export VaultEntry[] to Anki-compatible CSV / TSV.
 *
 * Anki import format (tab-separated):
 *   Front \t Back \t Tags
 *
 * Import steps for user:
 *   1. Open Anki → File → Import
 *   2. Select the downloaded .txt file
 *   3. Set "Fields separated by: Tab"
 *   4. Map Field 1 → Front, Field 2 → Back, Field 3 → Tags
 */

import type { VaultEntry } from '../types';

export function exportToAnkiTSV(entries: VaultEntry[]): string {
  const header = '#separator:tab\n#html:false\n#notetype:Basic\n#deck:Umai Japanese\n';
  const rows = entries.map(e => {
    const front = e.japanese.replace(/\t/g, ' ').replace(/\n/g, ' ');
    const back  = [
      e.reading  ? `Reading: ${e.reading}` : '',
      e.meaning  ? `Meaning: ${e.meaning}` : '',
      `Source: ${e.source_anime} Ep.${e.source_episode}`,
    ].filter(Boolean).join('<br>');
    const tags  = e.tags.join(' ').replace(/\s+/g, '_') || 'umai';
    return `${front}\t${back}\t${tags}`;
  });
  return header + rows.join('\n');
}

export function downloadAnkiTSV(entries: VaultEntry[], filename = 'umai-vault.txt'): void {
  const content = exportToAnkiTSV(entries);
  const blob    = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = filename;
  a.click();
  URL.revokeObjectURL(url);
}
