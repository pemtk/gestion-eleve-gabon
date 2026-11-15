/**
 * Retire d'un JPEG les métadonnées qui trahissent la vie privée (position GPS, modèle de l'appareil, date, miniature…) :
 * segments EXIF/XMP (APP1), IPTC (APP13) et commentaires (COM). Le profil de couleur (APP2) est conservé.
 * Seule l'orientation EXIF est réécrite, dans un EXIF minimal : sans elle, les photos prises en portrait s'afficheraient couchées.
 */
export function stripJpegMetadata(input: Buffer): Buffer {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return input;
  const out: Buffer[] = [input.subarray(0, 2)];
  let orientation: number | null = null;
  let i = 2;
  while (i + 4 <= input.length) {
    if (input[i] !== 0xff) break; // données inattendues : on garde le reste tel quel
    const marker = input[i + 1]!;
    if (marker === 0xff) { i++; continue; } // octets de remplissage
    if (marker === 0xda || marker === 0xd9) break; // début des données image / fin
    if (marker >= 0xd0 && marker <= 0xd7 || marker === 0x01) { out.push(input.subarray(i, i + 2)); i += 2; continue; }
    const length = input.readUInt16BE(i + 2);
    const end = i + 2 + length;
    if (length < 2 || end > input.length) return input; // fichier tronqué ou illisible : on ne touche à rien
    const segment = input.subarray(i, end);
    if (marker === 0xe1) orientation ??= exifOrientation(input.subarray(i + 4, end));
    else if (marker !== 0xed && marker !== 0xfe) out.push(segment); // APP13 (IPTC) et COM retirés ; APP1 traité plus bas
    i = end;
  }
  const rest = input.subarray(i);
  const head = out[0]!;
  const kept = out.slice(1);
  const exif = orientation && orientation > 1 && orientation <= 8 ? [minimalExif(orientation)] : [];
  return Buffer.concat([head, ...exif, ...kept, rest]);
}

/** Orientation (1 à 8) lue dans un segment EXIF, ou `null`. */
export function exifOrientation(seg: Buffer): number | null {
  if (seg.length < 14 || seg.subarray(0, 6).toString('latin1') !== 'Exif\0\0') return null;
  const t = seg.subarray(6);
  const little = t.subarray(0, 2).toString('latin1') === 'II';
  const u16 = (o: number) => (little ? t.readUInt16LE(o) : t.readUInt16BE(o));
  const u32 = (o: number) => (little ? t.readUInt32LE(o) : t.readUInt32BE(o));
  if (t.length < 8) return null;
  const ifd = u32(4);
  if (ifd + 2 > t.length) return null;
  const entries = u16(ifd);
  for (let k = 0; k < entries; k++) {
    const o = ifd + 2 + k * 12;
    if (o + 12 > t.length) return null;
    if (u16(o) === 0x0112) return u16(o + 8);
  }
  return null;
}

/** EXIF réduit à la seule orientation (segment APP1 de 36 octets). */
function minimalExif(orientation: number): Buffer {
  const b = Buffer.alloc(36);
  b.writeUInt16BE(0xffe1, 0);
  b.writeUInt16BE(34, 2);
  b.write('Exif\0\0', 4, 'latin1');
  b.write('MM', 10, 'latin1'); // gros-boutiste
  b.writeUInt16BE(42, 12);
  b.writeUInt32BE(8, 14); // IFD0 juste après l'en-tête TIFF
  b.writeUInt16BE(1, 18); // une entrée
  b.writeUInt16BE(0x0112, 20); // Orientation
  b.writeUInt16BE(3, 22); // type SHORT
  b.writeUInt32BE(1, 24); // une valeur
  b.writeUInt16BE(orientation, 28);
  return b; // les 6 derniers octets (valeur, IFD suivant = 0) sont déjà à zéro
}
