import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exifOrientation, stripJpegMetadata } from './jpeg.js';
import { signatureOf, verifySignature } from './signing.js';
import { safeName, sniffType } from './sniff.js';
import { LocalDiskStorage } from './storage.js';

const seg = (marker: number, payload: Buffer) => {
  const h = Buffer.alloc(4);
  h.writeUInt16BE(0xff00 | marker, 0);
  h.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([h, payload]);
};
/** EXIF petit-boutiste avec orientation et une « position GPS » fictive reconnaissable. */
function exif(orientation: number): Buffer {
  const tiff = Buffer.alloc(8 + 2 + 12 + 4);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(orientation, 18);
  return Buffer.concat([
    Buffer.from('Exif\0\0', 'latin1'),
    tiff,
    Buffer.from('GPS:0.3476N,32.5825E;Pixel 9'),
  ]);
}
const image = (orientation = 6) =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe1, exif(orientation)),
    seg(0xed, Buffer.from('IPTC-photographe')),
    seg(0xfe, Buffer.from('commentaire privé')),
    seg(0xe2, Buffer.from('ICC_PROFILE')),
    seg(0xdb, Buffer.from([1, 2, 3, 4])),
    Buffer.from([0xff, 0xda, 0, 4, 9, 9, 7, 7, 7, 0xff, 0xd9]),
  ]);

describe('stripJpegMetadata', () => {
  it('retire la position, l’appareil, l’IPTC et les commentaires, mais garde le profil couleur et l’image', () => {
    const out = stripJpegMetadata(image());
    for (const secret of [
      'GPS:0.3476N',
      'Pixel 9',
      'IPTC-photographe',
      'commentaire privé',
    ])
      expect(out.includes(Buffer.from(secret))).toBe(false);
    expect(out.includes(Buffer.from('ICC_PROFILE'))).toBe(true);
    expect(
      out
        .subarray(out.length - 11)
        .equals(Buffer.from([0xff, 0xda, 0, 4, 9, 9, 7, 7, 7, 0xff, 0xd9])),
    ).toBe(true);
    expect(sniffType(out)).toBe('image/jpeg');
    expect(out.length).toBeLessThan(image().length);
  });
  it('conserve l’orientation pour que la photo ne soit pas couchée', () => {
    const out = stripJpegMetadata(image(6));
    const app1 = out.subarray(out.indexOf(Buffer.from([0xff, 0xe1])) + 4);
    expect(exifOrientation(app1)).toBe(6);
  });
  it('n’ajoute rien quand l’orientation est normale ou absente', () => {
    expect(
      stripJpegMetadata(image(1)).includes(Buffer.from([0xff, 0xe1])),
    ).toBe(false);
  });
  it('laisse intact un fichier tronqué ou qui n’est pas un JPEG', () => {
    const truncated = image().subarray(0, 30);
    expect(stripJpegMetadata(truncated).equals(truncated)).toBe(true);
    expect(stripJpegMetadata(Buffer.from('pas une image')).toString()).toBe(
      'pas une image',
    );
  });
});

describe('sniffType', () => {
  it('reconnaît les formats acceptés d’après leurs octets', () => {
    expect(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(
      sniffType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
      ),
    ).toBe('image/png');
    expect(
      sniffType(
        Buffer.concat([
          Buffer.from('RIFF'),
          Buffer.alloc(4),
          Buffer.from('WEBPVP8 '),
        ]),
      ),
    ).toBe('image/webp');
    expect(sniffType(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
  });
  it('refuse le reste, même déguisé', () => {
    for (const body of [
      '<script>alert(1)</script>',
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
      'MZ\x90\x00',
      'GIF89a',
      '',
    ])
      expect(sniffType(Buffer.from(body))).toBeNull();
  });
  it('donne un nom sûr, avec l’extension du vrai type', () => {
    expect(safeName('../../etc/passwd.exe', 'image/jpeg')).toBe('passwd.jpg');
    expect(safeName('C:\\Users\\moi\\cahier "maths".png', 'image/png')).toBe(
      'cahier maths.png',
    );
    expect(safeName(undefined, 'application/pdf')).toBe('fichier.pdf');
    expect(safeName('a'.repeat(200) + '.jpg', 'image/jpeg').length).toBe(84);
  });
});

describe('liens signés', () => {
  const now = Date.UTC(2026, 10, 15, 12);
  const exp = Math.floor(now / 1000) + 300;
  it('acceptent la bonne signature jusqu’à l’échéance', () => {
    const sig = signatureOf('f1', exp, 'secret');
    expect(verifySignature('f1', exp, sig, now, 'secret')).toBe(true);
    expect(verifySignature('f1', exp, sig, now + 299_000, 'secret')).toBe(true);
  });
  it('refusent un lien échu, un autre fichier, une autre date ou une autre clé', () => {
    const sig = signatureOf('f1', exp, 'secret');
    expect(verifySignature('f1', exp, sig, now + 301_000, 'secret')).toBe(
      false,
    );
    expect(verifySignature('f2', exp, sig, now, 'secret')).toBe(false);
    expect(verifySignature('f1', exp + 3600, sig, now, 'secret')).toBe(false);
    expect(verifySignature('f1', exp, sig, now, 'autre')).toBe(false);
    expect(verifySignature('f1', exp, '', now, 'secret')).toBe(false);
    expect(verifySignature('f1', Number.NaN, sig, now, 'secret')).toBe(false);
  });
});

describe('LocalDiskStorage', () => {
  it('écrit, relit et supprime un objet', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sge-files-'));
    const storage = new LocalDiskStorage(root);
    await storage.put('o2/abc', Buffer.from('contenu'));
    expect((await storage.get('o2/abc'))?.toString()).toBe('contenu');
    expect(await storage.get('o2/absent')).toBeNull();
    await storage.delete('o2/abc');
    expect(await storage.get('o2/abc')).toBeNull();
    await storage.delete('o2/abc'); // idempotent
    expect(await readdir(root)).toEqual(['o2']);
  });
  it('refuse toute clé qui sortirait du dossier', async () => {
    const storage = new LocalDiskStorage(
      await mkdtemp(join(tmpdir(), 'sge-files-')),
    );
    for (const key of [
      '../secret',
      'a/../../secret',
      '/etc/passwd',
      'a//b',
      '.hidden/..',
      'a\\b',
      '',
    ])
      await expect(storage.put(key, Buffer.from('x'))).rejects.toThrow();
    await expect(storage.get('../x')).rejects.toThrow();
  });
});
