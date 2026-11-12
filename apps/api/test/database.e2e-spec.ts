import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { App } from 'supertest/types.js';
import { client, createApp, dbOf, reset } from './helpers.js';
import { messages, students } from '../src/db/schema.js';

describe('Base de données PostgreSQL', () => {
  let app: INestApplication<App>;
  let c: ReturnType<typeof client>;
  beforeAll(async () => { app = await createApp(); c = client(app); });
  afterAll(() => app.close());
  beforeEach(() => reset(app));

  it('applique les migrations : toutes les tables existent', async () => {
    const { rows } = await dbOf(app).execute(sql`select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name in ('users','students','cases','messages','organizations')`);
    expect(rows[0]).toMatchObject({ n: 5 });
  });

  it('conserve les données entre deux démarrages de l’API', async () => {
    const eleve = await c.token('etablissement');
    await c.api().post('/school/classes').set(c.as(eleve)).send({ level: 'Collège', name: '6ème D', capacity: 40 }).expect(201);
    await app.close();
    app = await (async () => { const { Test } = await import('@nestjs/testing'); const { AppModule } = await import('../src/app.module.js'); const m = await Test.createTestingModule({ imports: [AppModule] }).compile(); const a = m.createNestApplication<INestApplication<App>>(); await a.init(); return a; })();
    c = client(app);
    const list = await c.api().get('/school/classes').set(c.as(await c.token('etablissement'))).expect(200);
    expect(list.body.map((x: { name: string }) => x.name)).toContain('6ème D');
  });

  it('refuse deux élèves avec le même code parent (contrainte UNIQUE)', async () => {
    const db = dbOf(app);
    const [first] = await db.select().from(students).limit(1);
    await expect(db.insert(students).values({ id: 'dup', firstName: 'X', lastName: 'Y', classId: first!.classId, code: first!.code })).rejects.toThrow();
  });

  it('ne valide une tâche qu’une seule fois même si deux requêtes arrivent ensemble', async () => {
    const t = await c.token('eleve');
    const send = () => c.api().post('/me/student/tasks/k1/complete').set(c.as(t)).send({ evaluation: 'ok', seconds: 600 });
    const results = await Promise.all([send(), send(), send()]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 400, 400]);
    const trophies = await c.api().get('/me/student/trophies').set(c.as(t)).expect(200);
    expect(trophies.body.points).toBe(1260); // 1240 + 20, pas davantage
  });

  it('n’enregistre qu’un message pour un même clientId, même envoyé en parallèle', async () => {
    const t = await c.token('parent');
    const send = () => c.api().post('/threads/th1/messages').set(c.as(t)).send({ text: 'Bonjour', clientId: 'same-id' });
    await Promise.all([send(), send(), send()]);
    const rows = await dbOf(app).select().from(messages).where(sql`${messages.clientId} = 'same-id'`);
    expect(rows).toHaveLength(1);
  });

  it('isole les conversations par profil', async () => {
    const parent = await c.token('parent');
    const prof = await c.token('enseignant');
    await c.api().get('/threads/th1/messages').set(c.as(parent)).expect(200);
    await c.api().get('/threads/th1/messages').set(c.as(prof)).expect(404);
  });

  it('historise les corrections de notes', async () => {
    const t = await c.token('etablissement');
    await c.api().post('/school/results/res0/correct').set(c.as(t)).send({ value: 16, reason: 'Erreur de saisie' }).expect(201);
    await c.api().post('/school/results/res0/correct').set(c.as(t)).send({ value: 17, reason: 'Deuxième relecture' }).expect(201);
    const { body } = await c.api().get('/school/results').set(c.as(t)).expect(200);
    const row = body.rows.find((r: { id: string }) => r.id === 'res0');
    expect(row.value).toBe(17);
    expect(row.history.map((h: { from: number; to: number }) => [h.from, h.to])).toEqual([[15.5, 16], [16, 17]]);
  });
});
