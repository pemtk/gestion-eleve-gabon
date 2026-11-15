import type { INestApplication } from '@nestjs/common';
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
import type { App } from 'supertest/types.js';
import {
  DEMO_PASSWORD,
  DEMO_SCHOOL_ID,
  DEMO_USERS,
  SECOND_SCHOOL_DIRECTOR,
} from '@sge/shared';
import { auditLog, files, students } from '../src/db/schema.js';
import { FilesService } from '../src/files/files.service.js';
import { signatureOf } from '../src/files/signing.js';
import { client, createApp, createUser, dbOf, reset } from './helpers.js';

const seg = (marker: number, payload: Buffer) => {
  const h = Buffer.alloc(4);
  h.writeUInt16BE(0xff00 | marker, 0);
  h.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([h, payload]);
};
/** Un JPEG minimal avec EXIF (orientation 6 + position GPS fictive). */
function jpeg(extra = 0): Buffer {
  const tiff = Buffer.alloc(20);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(6, 18);
  const exif = Buffer.concat([
    Buffer.from('Exif\0\0', 'latin1'),
    tiff,
    Buffer.from('GPS:0.3476N,32.5825E'),
  ]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe1, exif),
    seg(0xdb, Buffer.from([1, 2, 3, 4])),
    Buffer.from([0xff, 0xda, 0, 4, 9, 9]),
    Buffer.alloc(extra, 7),
    Buffer.from([0xff, 0xd9]),
  ]);
}
const png = () =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32),
  ]);
const pdf = () => Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF');
const MB = 1024 * 1024;

/** Ticket #22 — stockage de fichiers : limites, types réels, droits de lecture par usage, liens signés. */
describe('Fichiers (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let c: ReturnType<typeof client>;
  let eleve: string;
  let prof: string;
  let ecole: string;
  let parent: string;
  const db = () => dbOf(app);
  const upload = (
    token: string | null,
    kind: string | undefined,
    body: Buffer | null,
    name = 'photo.jpg',
    type = 'image/jpeg',
  ) => {
    let r = c.api().post('/files');
    if (token) r = r.set(c.as(token));
    if (kind) r = r.field('kind', kind);
    return body
      ? r.attach('file', body, { filename: name, contentType: type })
      : r;
  };
  const send = async (
    token: string,
    kind: string,
    body: Buffer,
    name?: string,
    type?: string,
  ) =>
    (await upload(token, kind, body, name, type).expect(201)).body as {
      id: string;
      kind: string;
      name: string;
      contentType: string;
      size: number;
    };
  const read = (token: string | null, id: string) =>
    (token
      ? c.api().get(`/files/${id}`).set(c.as(token))
      : c.api().get(`/files/${id}`)
    )
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (d: Buffer) => chunks.push(d));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  const login = async (phone: string) =>
    (
      await c
        .api()
        .post('/auth/login')
        .send({ mode: 'password', phone, password: DEMO_PASSWORD })
        .expect(201)
    ).body.accessToken as string;

  beforeAll(async () => {
    app = await createApp();
    c = client(app);
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await reset(app);
    [eleve, prof, ecole, parent] = await Promise.all([
      c.token('eleve'),
      c.token('enseignant'),
      c.token('etablissement'),
      c.token('parent'),
    ]);
  });

  describe('envoi : types, tailles et profils', () => {
    it('accepte une image, l’identifie d’après ses octets et ne divulgue ni chemin ni clé de stockage', async () => {
      const f = await send(
        eleve,
        'proof',
        jpeg(),
        '../../etc/cahier.exe',
        'application/x-msdownload',
      ); // nom et type annoncés : ignorés
      expect(f).toMatchObject({
        kind: 'proof',
        name: 'cahier.jpg',
        contentType: 'image/jpeg',
      });
      expect(Object.keys(f).sort()).toEqual([
        'contentType',
        'id',
        'kind',
        'name',
        'size',
      ]);
    });

    it('refuse les formats non acceptés, quelle que soit l’extension ou le type annoncé', async () => {
      const bad: [string, Buffer, string, string][] = [
        [
          'page web déguisée en JPEG',
          Buffer.from('<html><script>alert(1)</script></html>'),
          'a.jpg',
          'image/jpeg',
        ],
        [
          'SVG',
          Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>',
          ),
          'a.svg',
          'image/svg+xml',
        ],
        [
          'exécutable',
          Buffer.from('MZ\x90\x00\x03\x00\x00\x00'),
          'a.png',
          'image/png',
        ],
        ['GIF', Buffer.from('GIF89a\x01\x00\x01\x00'), 'a.gif', 'image/gif'],
        ['PDF pour une photo de preuve', pdf(), 'a.pdf', 'application/pdf'],
      ];
      for (const [, body, name, type] of bad) {
        const res = await upload(eleve, 'proof', body, name, type).expect(415);
        expect(res.body.message).toMatch(
          /Format non accepté.*JPEG, PNG ou WebP/,
        );
      }
      expect(await db().select().from(files)).toHaveLength(0);
    });

    it('refuse les fichiers au-delà de la limite de l’usage, et au-delà du plafond absolu', async () => {
      const proof = await upload(
        eleve,
        'proof',
        jpeg(5 * MB),
        'gros.jpg',
      ).expect(413);
      expect(proof.body.message).toBe('Photo de preuve : 5 Mo au maximum.');
      expect(
        (await upload(eleve, 'avatar', jpeg(2 * MB), 'gros.jpg').expect(413))
          .body.message,
      ).toBe('Photo de profil : 2 Mo au maximum.');
      expect(
        (
          await upload(
            ecole,
            'attachment',
            Buffer.concat([pdf(), Buffer.alloc(5 * MB)]),
            'gros.pdf',
            'application/pdf',
          ).expect(413)
        ).body.message,
      ).toBe('Pièce jointe : 5 Mo au maximum.');
      expect(
        (await upload(eleve, 'proof', jpeg(11 * MB)).expect(413)).body.message,
      ).toBe('Fichier trop volumineux.');
      await send(eleve, 'proof', jpeg(4 * MB)); // sous la limite : accepté
      expect(await db().select().from(files)).toHaveLength(1);
    });

    it('refuse un envoi vide, sans fichier, sans usage valide ou sans session', async () => {
      await upload(eleve, 'proof', Buffer.alloc(0)).expect(400);
      await upload(eleve, 'proof', null).expect(400);
      await upload(eleve, 'nimporte', jpeg()).expect(400);
      await upload(eleve, undefined, jpeg()).expect(400);
      await upload(null, 'proof', jpeg()).expect(401);
    });

    it('réserve chaque usage à ses profils', async () => {
      await upload(parent, 'proof', jpeg()).expect(403);
      await upload(prof, 'proof', jpeg()).expect(403);
      await upload(
        eleve,
        'attachment',
        pdf(),
        'a.pdf',
        'application/pdf',
      ).expect(403);
      await upload(prof, 'report', pdf(), 'a.pdf', 'application/pdf').expect(
        403,
      );
      await upload(ecole, 'proof', jpeg()).expect(403);
      await upload(
        await c.token('agent'),
        'attachment',
        pdf(),
        'a.pdf',
        'application/pdf',
      ).expect(403);
      await send(parent, 'avatar', png(), 'moi.png', 'image/png'); // le parent peut avoir une photo de profil
    });

    it('retire les métadonnées d’un JPEG (position GPS, appareil) mais garde l’orientation', async () => {
      const f = await send(eleve, 'proof', jpeg());
      const stored = (await read(eleve, f.id).expect(200)).body as Buffer;
      expect(stored.includes(Buffer.from('GPS:0.3476N'))).toBe(false);
      expect(stored.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))).toBe(
        true,
      );
      expect(stored.includes(Buffer.from([0xff, 0xe1]))).toBe(true); // EXIF minimal : orientation seulement
      expect(f.size).toBe(stored.length);
    });

    it('limite le nombre d’envois par utilisateur', async () => {
      for (let i = 0; i < 30; i++)
        await upload(parent, 'avatar', png(), `a${i}.png`, 'image/png').expect(
          201,
        );
      const res = await upload(
        parent,
        'avatar',
        png(),
        'x.png',
        'image/png',
      ).expect(429);
      expect(res.body.code).toBe('RATE_LIMITED');
    });

    it('purge les fichiers jamais utilisés, et jamais ceux qui le sont', async () => {
      const orphan = await send(eleve, 'proof', jpeg());
      const used = await send(
        ecole,
        'attachment',
        pdf(),
        'a.pdf',
        'application/pdf',
      );
      await c
        .api()
        .post('/school/announcements')
        .set(c.as(ecole))
        .send({
          message: 'Réunion',
          audience: 'school',
          attachmentFileId: used.id,
        })
        .expect(201);
      const keys = Object.fromEntries(
        (await db().select().from(files)).map((f) => [f.id, f.storageKey]),
      );
      const storage = app.get(FilesService).storage;
      expect(await storage.get(keys[orphan.id]!)).not.toBeNull();
      await db()
        .update(files)
        .set({ createdAt: sql`now() - interval '2 days'` });
      expect(await app.get(FilesService).purgeOrphans()).toBe(1);
      await read(eleve, orphan.id).expect(404);
      await read(ecole, used.id).expect(200);
      expect(await storage.get(keys[orphan.id]!)).toBeNull(); // l'objet a disparu avec la ligne
      expect(await storage.get(keys[used.id]!)).not.toBeNull();
    });

    it('supprime un fichier en attente, mais pas un fichier utilisé', async () => {
      const f = await send(eleve, 'proof', jpeg());
      await c.api().delete(`/files/${f.id}`).set(c.as(parent)).expect(404);
      await c.api().delete(`/files/${f.id}`).set(c.as(eleve)).expect(200);
      await read(eleve, f.id).expect(404);
      const used = await send(eleve, 'proof', jpeg());
      await c
        .api()
        .post('/me/student/tasks/k1/complete')
        .set(c.as(eleve))
        .send({ evaluation: 'ok', seconds: 120, proofFileId: used.id })
        .expect(201);
      await c.api().delete(`/files/${used.id}`).set(c.as(eleve)).expect(403);
    });
  });

  describe('photo de preuve (§11.3) : visible de l’enseignant uniquement', () => {
    let proof: { id: string };
    beforeEach(async () => {
      proof = await send(eleve, 'proof', jpeg());
      await c
        .api()
        .post('/me/student/tasks/k1/complete')
        .set(c.as(eleve))
        .send({ evaluation: 'ok', seconds: 120, proofFileId: proof.id })
        .expect(201);
    });

    it('l’enseignant de la classe la voit, avec l’identifiant dans le suivi de la tâche', async () => {
      const rows = (
        await c
          .api()
          .get('/me/teacher/tasks/k1/follow-up')
          .set(c.as(prof))
          .expect(200)
      ).body.rows as {
        studentId: string;
        proof: boolean;
        proofFileId: string | null;
      }[];
      expect(rows.find((r) => r.studentId === 's1')).toMatchObject({
        proof: true,
        proofFileId: proof.id,
      });
      const res = await read(prof, proof.id).expect(200);
      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(res.headers['content-disposition']).toMatch(/^inline/);
      expect((res.body as Buffer).length).toBe(
        rows.length
          ? (await db().select().from(files).where(eq(files.id, proof.id)))[0]!
              .size
          : 0,
      );
    });

    it('personne d’autre ne la voit : direction, autre élève, parent, enseignant d’une autre classe, autre école, anonyme', async () => {
      await read(eleve, proof.id).expect(200); // l'élève la voit toujours
      await read(ecole, proof.id).expect(404);
      await read(parent, proof.id).expect(404);
      await read(await login('07123000'), proof.id).expect(404); // Brice, un autre élève de la classe
      const autre = await createUser(app, {
        id: 'u-prof-x',
        phone: '07555000',
        role: 'enseignant',
        schoolId: DEMO_SCHOOL_ID,
      });
      await read(autre, proof.id).expect(404); // enseignant de l'école sans cette classe
      await read(await login(SECOND_SCHOOL_DIRECTOR.phone), proof.id).expect(
        404,
      );
      await read(await c.token('admin'), proof.id).expect(404);
      await read(null, proof.id).expect(401);
    });

    it('le parent ne la voit que si l’école l’a autorisé (réglage §11.3)', async () => {
      expect(
        (
          await c
            .api()
            .get('/school/photo-settings')
            .set(c.as(ecole))
            .expect(200)
        ).body,
      ).toEqual({ proofVisibleToParents: false });
      await c
        .api()
        .put('/school/photo-settings')
        .set(c.as(ecole))
        .send({ proofVisibleToParents: true })
        .expect(200);
      await read(parent, proof.id).expect(200);
      await read(ecole, proof.id).expect(404); // la direction n'y gagne rien
      await c
        .api()
        .put('/school/photo-settings')
        .set(c.as(ecole))
        .send({ proofVisibleToParents: false })
        .expect(200);
      await read(parent, proof.id).expect(404);
      await c
        .api()
        .put('/school/photo-settings')
        .set(c.as(prof))
        .send({ proofVisibleToParents: true })
        .expect(403);
    });

    it('un parent d’un autre élève ne la voit pas, même quand l’école autorise les parents', async () => {
      await c
        .api()
        .put('/school/photo-settings')
        .set(c.as(ecole))
        .send({ proofVisibleToParents: true })
        .expect(200);
      const autreParent = await createUser(app, {
        id: 'u-parent-x',
        phone: '06555111',
        role: 'parent',
        schoolId: null,
      });
      await read(autreParent, proof.id).expect(404);
    });

    it('trace les consultations par un tiers et les tentatives refusées', async () => {
      await read(prof, proof.id).expect(200);
      await read(ecole, proof.id).expect(404);
      await read(eleve, proof.id).expect(200); // le propriétaire n'est pas tracé
      const log = await db()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, 'file.read'))
        .orderBy(auditLog.id);
      expect(log.map((l) => [l.userId, l.outcome])).toEqual([
        [DEMO_USERS.enseignant.id, 'ok'],
        [DEMO_USERS.etablissement.id, 'refuse'],
      ]);
    });

    it('un fichier ne sert qu’une fois : ni réutilisé, ni emprunté, ni d’un autre usage', async () => {
      const done = await send(eleve, 'proof', jpeg());
      await c
        .api()
        .post('/me/student/tasks/k5/complete')
        .set(c.as(eleve))
        .send({ evaluation: 'ok', seconds: 120, proofFileId: proof.id })
        .expect(400); // déjà rattaché à k1
      const [camarade] = await db()
        .select({ phone: students.phone })
        .from(students)
        .where(
          and(
            eq(students.classId, '3b'),
            isNotNull(students.userId),
            ne(students.id, 's1'),
            isNotNull(students.phone),
          ),
        );
      const brice = await login(
        camarade!.phone!.replace('+241', '').replace(/\s/g, ''),
      );
      await c
        .api()
        .post('/me/student/tasks/k5/complete')
        .set(c.as(brice))
        .send({ evaluation: 'ok', seconds: 120, proofFileId: done.id })
        .expect(400); // fichier d'un autre élève de la classe
      const avatar = await send(eleve, 'avatar', png(), 'p.png', 'image/png');
      await c
        .api()
        .post('/me/student/tasks/k5/complete')
        .set(c.as(eleve))
        .send({ evaluation: 'ok', seconds: 120, proofFileId: avatar.id })
        .expect(400); // mauvais usage
      await c
        .api()
        .post('/me/student/tasks/k5/complete')
        .set(c.as(eleve))
        .send({ evaluation: 'ok', seconds: 120, proofFileId: 'inconnu' })
        .expect(400);
      const row = (
        await db().select().from(files).where(eq(files.id, done.id))
      )[0]!;
      expect(row.status).toBe('pending'); // les refus n'ont rien consommé
    });

    it('un devoir à photo obligatoire ne se valide pas sans photo', async () => {
      const task = (
        await c
          .api()
          .post('/me/teacher/tasks')
          .set(c.as(prof))
          .send({
            classId: '3b',
            subject: 'Mathématiques',
            type: 'Devoir',
            title: 'Devoir maison',
            due: 'Vendredi',
            requirePhoto: true,
          })
          .expect(201)
      ).body.task as { id: string };
      const refused = await c
        .api()
        .post(`/me/student/tasks/${task.id}/complete`)
        .set(c.as(eleve))
        .send({ evaluation: 'ok', seconds: 600 })
        .expect(400);
      expect(refused.body.message).toBe(
        'La photo du devoir est obligatoire pour valider cette tâche.',
      );
      const photo = await send(eleve, 'proof', jpeg());
      await c
        .api()
        .post(`/me/student/tasks/${task.id}/complete`)
        .set(c.as(eleve))
        .send({ evaluation: 'ok', seconds: 600, proofFileId: photo.id })
        .expect(201);
    });

    it('l’indicateur « proof » envoyé sans fichier n’est plus cru', async () => {
      await c
        .api()
        .post('/me/student/tasks/k5/complete')
        .set(c.as(eleve))
        .send({ evaluation: 'ok', seconds: 120, proof: true })
        .expect(201);
      const rows = (
        await c
          .api()
          .get('/me/teacher/tasks/k5/follow-up')
          .set(c.as(prof))
          .expect(200)
      ).body.rows as { studentId: string; proof: boolean }[];
      expect(rows.find((r) => r.studentId === 's1')?.proof).toBe(false);
    });
  });

  describe('liens signés', () => {
    let proof: { id: string };
    const path = (url: string) => url.replace(/^\/api/, '');
    beforeEach(async () => {
      proof = await send(eleve, 'proof', jpeg());
      await c
        .api()
        .post('/me/student/tasks/k1/complete')
        .set(c.as(eleve))
        .send({ evaluation: 'ok', seconds: 120, proofFileId: proof.id })
        .expect(201);
    });

    it('donne un lien de 5 minutes à qui peut lire le fichier, et il s’ouvre sans session', async () => {
      const link = (
        await c.api().get(`/files/${proof.id}/url`).set(c.as(prof)).expect(200)
      ).body as { url: string; expiresAt: string };
      expect(new Date(link.expiresAt).getTime() - Date.now()).toBeGreaterThan(
        280_000,
      );
      expect(
        new Date(link.expiresAt).getTime() - Date.now(),
      ).toBeLessThanOrEqual(300_000);
      const res = await c
        .api()
        .get(path(link.url))
        .buffer(true)
        .parse((r, cb) => {
          const b: Buffer[] = [];
          r.on('data', (d: Buffer) => b.push(d));
          r.on('end', () => cb(null, Buffer.concat(b)));
        })
        .expect(200);
      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(
        (res.body as Buffer).equals(
          (await read(prof, proof.id)).body as Buffer,
        ),
      ).toBe(true);
    });

    it('refuse un lien pour qui ne peut pas lire le fichier', async () => {
      await c.api().get(`/files/${proof.id}/url`).set(c.as(ecole)).expect(404);
      await c.api().get(`/files/${proof.id}/url`).set(c.as(parent)).expect(404);
      await c.api().get(`/files/${proof.id}/url`).expect(401);
    });

    it('refuse un lien modifié, expiré, ou emprunté pour un autre fichier', async () => {
      const link = (
        await c.api().get(`/files/${proof.id}/url`).set(c.as(prof)).expect(200)
      ).body as { url: string };
      const url = new URL(path(link.url), 'http://x');
      const exp = Number(url.searchParams.get('exp'));
      const sig = url.searchParams.get('sig')!;
      await c
        .api()
        .get(`/files/${proof.id}/content?exp=${exp + 3600}&sig=${sig}`)
        .expect(404); // date rallongée
      await c
        .api()
        .get(`/files/${proof.id}/content?exp=${exp}&sig=${sig.slice(0, -2)}xx`)
        .expect(404);
      await c.api().get(`/files/${proof.id}/content?exp=${exp}`).expect(404);
      const past = Math.floor(Date.now() / 1000) - 10;
      await c
        .api()
        .get(
          `/files/${proof.id}/content?exp=${past}&sig=${signatureOf(proof.id, past)}`,
        )
        .expect(404); // échu, pourtant bien signé
      const other = await send(eleve, 'avatar', png(), 'p.png', 'image/png');
      await c
        .api()
        .get(`/files/${other.id}/content?exp=${exp}&sig=${sig}`)
        .expect(404);
      await c
        .api()
        .get(`/files/${proof.id}/content?exp=${exp}&sig=${sig}`)
        .expect(200);
    });
  });

  describe('photo de profil (§3.4) : visible selon le choix de l’utilisateur', () => {
    let avatar: { id: string };
    beforeEach(async () => {
      avatar = await send(prof, 'avatar', jpeg(), 'moi.jpg');
      await c
        .api()
        .put('/me/avatar')
        .set(c.as(prof))
        .send({ fileId: avatar.id })
        .expect(200);
    });

    it('apparaît dans le profil et dans /auth/me', async () => {
      expect(
        (await c.api().get('/me/profile').set(c.as(prof)).expect(200)).body,
      ).toMatchObject({ avatarFileId: avatar.id, photoVisibility: 'school' });
      expect(
        (await c.api().get('/auth/me').set(c.as(prof)).expect(200)).body
          .avatarFileId,
      ).toBe(avatar.id);
    });

    it('« mon école » : élèves, collègues et direction de l’école la voient, pas une autre école', async () => {
      await read(eleve, avatar.id).expect(200);
      await read(ecole, avatar.id).expect(200);
      await read(parent, avatar.id).expect(200); // parent d'un élève de l'école
      await read(await login(SECOND_SCHOOL_DIRECTOR.phone), avatar.id).expect(
        404,
      );
      await read(await c.token('admin'), avatar.id).expect(404);
    });

    it('« enseignants seulement » : l’élève et le parent ne la voient plus, un collègue oui', async () => {
      await c
        .api()
        .put('/me/profile')
        .set(c.as(prof))
        .send({
          firstName: 'Sylvain',
          lastName: 'Ndong',
          photoVisibility: 'teachers',
        })
        .expect(200);
      await read(eleve, avatar.id).expect(404);
      await read(parent, avatar.id).expect(404);
      const collegue = await createUser(app, {
        id: 'u-prof-y',
        phone: '07555001',
        role: 'enseignant',
        schoolId: DEMO_SCHOOL_ID,
      });
      await read(collegue, avatar.id).expect(200);
      await read(prof, avatar.id).expect(200);
    });

    it('« privée » : seul son propriétaire la voit', async () => {
      await c
        .api()
        .put('/me/profile')
        .set(c.as(prof))
        .send({
          firstName: 'Sylvain',
          lastName: 'Ndong',
          photoVisibility: 'private',
        })
        .expect(200);
      for (const t of [eleve, ecole, parent])
        await read(t, avatar.id).expect(404);
      await read(prof, avatar.id).expect(200);
    });

    it('remplacer la photo supprime l’ancienne ; la retirer supprime la photo', async () => {
      const next = await send(
        prof,
        'avatar',
        png(),
        'nouvelle.png',
        'image/png',
      );
      await c
        .api()
        .put('/me/avatar')
        .set(c.as(prof))
        .send({ fileId: next.id })
        .expect(200);
      await read(prof, avatar.id).expect(404);
      await read(prof, next.id).expect(200);
      await c.api().delete('/me/avatar').set(c.as(prof)).expect(200);
      await read(prof, next.id).expect(404);
      expect(
        (await c.api().get('/me/profile').set(c.as(prof)).expect(200)).body
          .avatarFileId,
      ).toBeNull();
    });

    it('on ne peut pas prendre le fichier d’un autre comme photo', async () => {
      const other = await send(eleve, 'avatar', png(), 'p.png', 'image/png');
      await c
        .api()
        .put('/me/avatar')
        .set(c.as(prof))
        .send({ fileId: other.id })
        .expect(400);
      expect(
        (await c.api().get('/me/profile').set(c.as(prof)).expect(200)).body
          .avatarFileId,
      ).toBe(avatar.id);
    });
  });

  describe('pièce jointe d’une annonce (§7.9)', () => {
    it('s’attache à l’annonce, s’affiche dans la liste et suit l’audience', async () => {
      const doc = await send(
        ecole,
        'attachment',
        pdf(),
        'Calendrier.pdf',
        'application/pdf',
      );
      const a = (
        await c
          .api()
          .post('/school/announcements')
          .set(c.as(ecole))
          .send({
            message: 'Calendrier des examens',
            audience: 'school',
            attachmentFileId: doc.id,
          })
          .expect(201)
      ).body;
      expect(a.attachment).toMatchObject({
        id: doc.id,
        name: 'Calendrier.pdf',
        contentType: 'application/pdf',
      });
      const list = (
        await c.api().get('/school/announcements').set(c.as(ecole)).expect(200)
      ).body as { id: string; attachment: { id: string } | null }[];
      expect(list.find((x) => x.id === a.id)?.attachment?.id).toBe(doc.id);
      const res = await read(eleve, doc.id).expect(200);
      expect(res.headers['content-disposition']).toMatch(/^attachment/); // un PDF se télécharge, il ne s'ouvre pas dans le navigateur
      await read(parent, doc.id).expect(200);
      await read(prof, doc.id).expect(200);
      await read(await login(SECOND_SCHOOL_DIRECTOR.phone), doc.id).expect(404);
    });

    it('une annonce réservée aux enseignants n’est pas lisible des élèves ni des parents', async () => {
      const doc = await send(
        ecole,
        'attachment',
        pdf(),
        'Consignes.pdf',
        'application/pdf',
      );
      await c
        .api()
        .post('/school/announcements')
        .set(c.as(ecole))
        .send({
          message: 'Consignes de surveillance',
          audience: 'teachers',
          attachmentFileId: doc.id,
        })
        .expect(201);
      await read(eleve, doc.id).expect(404);
      await read(parent, doc.id).expect(404);
      await read(prof, doc.id).expect(200);
    });

    it('un fichier non envoyé par la direction, ou déjà utilisé, est refusé et l’annonce n’est pas créée', async () => {
      const doc = await send(
        ecole,
        'attachment',
        pdf(),
        'a.pdf',
        'application/pdf',
      );
      await c
        .api()
        .post('/school/announcements')
        .set(c.as(ecole))
        .send({ message: 'Un', audience: 'school', attachmentFileId: doc.id })
        .expect(201);
      const before = (
        await c.api().get('/school/announcements').set(c.as(ecole)).expect(200)
      ).body.length;
      await c
        .api()
        .post('/school/announcements')
        .set(c.as(ecole))
        .send({ message: 'Deux', audience: 'school', attachmentFileId: doc.id })
        .expect(400);
      await c
        .api()
        .post('/school/announcements')
        .set(c.as(ecole))
        .send({
          message: 'Trois',
          audience: 'school',
          attachmentFileId: 'inconnu',
        })
        .expect(400);
      expect(
        (
          await c
            .api()
            .get('/school/announcements')
            .set(c.as(ecole))
            .expect(200)
        ).body.length,
      ).toBe(before);
    });
  });

  describe('pièce jointe d’un compte-rendu de visite (§8.3)', () => {
    it('visible de l’agent et de l’administrateur ; de l’école seulement si l’agent la partage', async () => {
      const agent = await c.token('agent');
      const admin = await c.token('admin');
      const secret = await send(agent, 'report', jpeg(), 'visite.jpg');
      const shared = await send(
        agent,
        'report',
        pdf(),
        'bilan.pdf',
        'application/pdf',
      );
      const body = {
        schoolId: 'Lycée Léon Mba',
        date: '12 nov.',
        observations: 'Visite',
      };
      const r1 = (
        await c
          .api()
          .post('/agent/reports')
          .set(c.as(agent))
          .send({
            ...body,
            visibleToSchool: false,
            attachmentFileId: secret.id,
          })
          .expect(201)
      ).body;
      const r2 = (
        await c
          .api()
          .post('/agent/reports')
          .set(c.as(agent))
          .send({
            ...body,
            observations: 'Bilan',
            visibleToSchool: true,
            attachmentFileId: shared.id,
          })
          .expect(201)
      ).body;
      expect(r1.attachment?.id).toBe(secret.id);
      await read(agent, secret.id).expect(200);
      await read(admin, secret.id).expect(200);
      await read(ecole, secret.id).expect(404);
      await read(ecole, shared.id).expect(200);
      await read(await login(SECOND_SCHOOL_DIRECTOR.phone), shared.id).expect(
        404,
      );
      await read(prof, shared.id).expect(404);
      const mine = (
        await c.api().get('/agent/reports').set(c.as(agent)).expect(200)
      ).body as { id: number; attachment: { id: string } | null }[];
      expect(mine.find((r) => r.id === r2.id)?.attachment?.id).toBe(shared.id);
      expect(
        (
          (
            await c
              .api()
              .get('/school/visit-reports')
              .set(c.as(ecole))
              .expect(200)
          ).body as { id: number }[]
        ).map((r) => r.id),
      ).toEqual([r2.id]);
      expect(
        (
          (await c.api().get('/admin/reports').set(c.as(admin)).expect(200))
            .body as { id: number }[]
        ).map((r) => r.id),
      ).toEqual(expect.arrayContaining([r1.id, r2.id]));
    });

    it('un agent ne joint un fichier qu’à un compte-rendu d’une école de son périmètre', async () => {
      const agent = await c.token('agent');
      const f = await send(agent, 'report', jpeg());
      await c
        .api()
        .post('/agent/reports')
        .set(c.as(agent))
        .send({
          schoolId: 'Collège inconnu',
          date: '12 nov.',
          observations: 'x',
          attachmentFileId: f.id,
        })
        .expect(404);
      expect(
        (await db().select().from(files).where(eq(files.id, f.id)))[0]?.status,
      ).toBe('pending');
    });
  });
});
