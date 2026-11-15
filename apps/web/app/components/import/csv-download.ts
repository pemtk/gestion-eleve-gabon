/** Télécharge un texte CSV (avec BOM UTF-8 pour qu'Excel lise bien les accents). */
export function downloadCsv(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}
