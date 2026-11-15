import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { App } from 'supertest/types.js';
import { files } from '../src/db/schema.js';
import { FilesService } from '../src/files/files.service.js';
import { fakeS3, type FakeS3 } from './fake-s3.js';
import { client, createApp, dbOf, reset } from './helpers.js';

const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xe1, 0, 22]), Buffer.from('Exif\0\0GPS-SECRET-1234'), Buffer.from([0xff, 0xda, 0, 4, 9, 9, 0xff, 0xd9])]);

/** Mêmes garanties avec le stockage objet S3 : octets chez le fournisseur, droits en base, liens présignés. */
describe('Fichiers sur stockage S3 (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let s3: FakeS3;
  let c: ReturnType<typeof client>;
  const saved = { ...process.env };

  beforeAll(async () => {
    s3 = await fakeS3('sge-fichiers');
    Object.assign(process.env, { FILES_DRIVER: 's3', FILES_S3_BUCKET: 'sge-fichiers', FILES_S3_ENDPOINT: s3.url, FILES_S3_REGION: 'us-east-1', FILES_S3_ACCESS_KEY_ID: 'AKIATEST', FILES_S3_SECRET_ACCESS_KEY: 'secret' });
    app = await createApp();
    c = client(app);
  });
  afterAll(async () => {
    await app.close();
    await s3.close();
    for (const k of ['FILES_DRIVER', 'FILES_S3_BUCKET', 'FILES_S3_ENDPOINT', 'FILES_S3_REGION', 'FILES_S3_ACCESS_KEY_ID', 'FILES_S3_SECRET_ACCESS_KEY']) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });
  beforeEach(() => reset(app));

  it('envoie les octets (sans métadonnées) au stockage, lit par l’API et par lien présigné, et purge', async () => {
    expect(app.get(FilesService).storage.driver).toBe('s3');
    const eleve = await c.token('eleve');
    const prof = await c.token('enseignant');
    const ecole = await c.token('etablissement');
    const up = (await c.api().post('/files').set(c.as(eleve)).field('kind', 'proof').attach('file', jpeg(), { filename: 'p.jpg', contentType: 'image/jpeg' }).expect(201)).body as { id: string };
    const [row] = await dbOf(app).select().from(files).where(eq(files.id, up.id));
    const object = s3.objects.get(row!.storageKey)!;
    expect(object.contentType).toBe('image/jpeg');
    expect(object.body.includes(Buffer.from('GPS-SECRET-1234'))).toBe(false); // nettoyé avant l'envoi au fournisseur
    await c.api().post('/me/student/tasks/k1/complete').set(c.as(eleve)).send({ evaluation: 'ok', seconds: 120, proofFileId: up.id }).expect(201);

    // lecture par l'API : mêmes droits qu'avec le disque
    expect((await c.api().get(`/files/${up.id}`).set(c.as(prof)).expect(200)).headers['content-type']).toBe('image/jpeg');
    await c.api().get(`/files/${up.id}`).set(c.as(ecole)).expect(404);

    // lien présigné vers le fournisseur : 5 minutes, ouvert sans session
    await c.api().get(`/files/${up.id}/url`).set(c.as(ecole)).expect(404);
    const link = (await c.api().get(`/files/${up.id}/url`).set(c.as(prof)).expect(200)).body as { url: string };
    const url = new URL(link.url);
    expect(url.origin).toBe(s3.url);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    const direct = await fetch(url);
    expect(direct.status).toBe(200);
    expect(Buffer.from(await direct.arrayBuffer()).equals(object.body)).toBe(true);

    // purge : l'objet est supprimé chez le fournisseur
    const orphan = (await c.api().post('/files').set(c.as(eleve)).field('kind', 'proof').attach('file', jpeg(), { filename: 'q.jpg', contentType: 'image/jpeg' }).expect(201)).body as { id: string };
    const [o] = await dbOf(app).select().from(files).where(eq(files.id, orphan.id));
    expect(s3.objects.has(o!.storageKey)).toBe(true);
    expect(await app.get(FilesService).purgeOrphans(0)).toBe(1);
    expect(s3.objects.has(o!.storageKey)).toBe(false);
    expect(s3.objects.has(row!.storageKey)).toBe(true);
  });
});
