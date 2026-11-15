/**
 * Type réel d'un fichier d'après ses premiers octets : le type annoncé par le client (en-tête, extension) n'est jamais cru.
 * Retourne `null` pour tout ce qui n'est pas un JPEG, un PNG, un WebP ou un PDF.
 */
export function sniffType(b: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (b.length >= 5 && b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

export const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

/** Nom d'affichage sûr : sans chemin ni caractères de contrôle, 80 caractères au plus, extension cohérente avec le vrai type. */
export function safeName(original: string | undefined, type: string): string {
  const clean = (original ?? '').split(/[\\/]/).pop()!.split('').filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127 && !'"<>:|?*'.includes(ch)).join('');
  const base = clean.replace(/\.[^.]*$/, '').trim().slice(0, 80);
  return `${base || 'fichier'}.${EXTENSION[type] ?? 'bin'}`;
}
