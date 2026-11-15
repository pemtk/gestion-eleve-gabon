import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeS3, type FakeS3 } from '../../test/fake-s3.js';
import { LocalDiskStorage, S3Storage, storageFromEnv } from './storage.js';

describe('S3Storage', () => {
  let s3: FakeS3;
  let storage: S3Storage;
  beforeAll(async () => {
    s3 = await fakeS3('sge');
    storage = new S3Storage('sge', {
      region: 'us-east-1',
      endpoint: s3.url,
      forcePathStyle: true,
      credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'secret' },
    });
  });
  afterAll(() => s3.close());

  it('écrit, relit et supprime un objet avec des requêtes signées', async () => {
    await storage.put('o2/abc', Buffer.from('contenu'), 'image/jpeg');
    expect(s3.objects.get('o2/abc')).toMatchObject({
      contentType: 'image/jpeg',
    });
    expect((await storage.get('o2/abc'))?.toString()).toBe('contenu');
    await storage.delete('o2/abc');
    expect(await storage.get('o2/abc')).toBeNull();
    expect(
      s3.requests.every((r) =>
        r.authorization?.startsWith('AWS4-HMAC-SHA256 Credential=AKIATEST/'),
      ),
    ).toBe(true);
  });

  it('fabrique un lien présigné de 5 minutes qui ouvre l’objet avec le bon type', async () => {
    await storage.put('o2/photo', Buffer.from('octets'), 'image/jpeg');
    const url = new URL(
      await storage.signedUrl('o2/photo', 300, {
        contentType: 'image/jpeg',
        filename: 'photo.jpg',
      }),
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get('response-content-disposition')).toBe(
      'inline; filename="photo.jpg"',
    );
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('octets');
    await fetch(`${s3.url}/sge/o2/photo`).then((r) =>
      expect(r.status).toBe(403),
    ); // sans signature : refusé
  });

  it('refuse toute clé qui n’est pas sûre', async () => {
    await expect(
      storage.put('../x', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow();
    await expect(storage.get('a//b')).rejects.toThrow();
  });
});

describe('choix du stockage par l’environnement', () => {
  it('prend le disque par défaut et S3 sur demande', () => {
    expect(storageFromEnv({})).toBeInstanceOf(LocalDiskStorage);
    expect(
      storageFromEnv({ FILES_DRIVER: 's3', FILES_S3_BUCKET: 'b' }).driver,
    ).toBe('s3');
    expect(() => storageFromEnv({ FILES_DRIVER: 's3' })).toThrow(
      /FILES_S3_BUCKET/,
    );
  });
});
