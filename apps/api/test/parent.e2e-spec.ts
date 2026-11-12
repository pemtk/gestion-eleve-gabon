import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { DEMO_SCHOOL_ID } from '@sge/shared';
import { client, createApp, createUser, reset } from './helpers.js';

type Kid = { id: string; name: string; className: string; school: string; alert: boolean; status: string; icon: string };

describe('Enfants du parent (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let c: ReturnType<typeof client>;
  beforeAll(async () => { app = await createApp(); c = client(app); });
  afterAll(() => app.close());
  beforeEach(() => reset(app));
  const get = (path: string, t: string) => c.api().get(path).set(c.as(t));
  const post = (path: string, t: string, body?: object) => c.api().post(path).set(c.as(t)).send(body);

  it('liste les enfants rattachés au parent, dans leurs établissements respectifs', async () => {
    const parent = await c.token('parent');
    const kids = (await get('/me/parent/children', parent).expect(200)).body as Kid[];
    expect(kids.map((k) => [k.name, k.className, k.school])).toEqual([
      ['Aïcha', '3ème B', 'Lycée Léon Mba'],
      ['Junior', 'CM2', 'École Saint-Michel'],
    ]);
    expect(kids[0]).toMatchObject({ alert: false, icon: 'circle-check' });
    expect(kids[0]!.status).toMatch(/^Tout va bien/);
    expect(kids[1]).toMatchObject({ alert: true, icon: 'user-x' });
    expect(kids[1]!.status).toMatch(/^Absent le 10 nov\./);
  });

  it('calcule le détail d’un enfant à partir de ses données réelles', async () => {
    const parent = await c.token('parent');
    const d = (await get('/me/parent/children/s1', parent).expect(200)).body;
    expect(d.stats.map((s: { value: string }) => s.value)).toEqual(['2', '4', '5 j', '1240']); // faites aujourd'hui, à faire, série, points
    expect(d.week).toHaveLength(7);
    expect(d.week.reduce((n: number, w: { minutes: number }) => n + w.minutes, 0)).toBe(340); // 5 h 40 de séances enregistrées
    expect(d.weekTotalLabel).toBe('5 h 40');
    expect(d.reward).toMatchObject({ label: 'Sortie au parc', left: 260 });
    expect(d.lastGrades).toHaveLength(2);
  });

  it('reflète une tâche terminée par l’élève (points, tâches du jour, temps de travail)', async () => {
    const eleve = await c.token('eleve');
    const parent = await c.token('parent');
    await post('/me/student/tasks/k1/complete', eleve, { evaluation: 'ok', seconds: 1200 }).expect(201); // 20 min
    const d = (await get('/me/parent/children/s1', parent).expect(200)).body;
    expect(d.stats.map((s: { value: string }) => s.value)).toEqual(['3', '3', '5 j', '1260']);
    expect(d.week.reduce((n: number, w: { minutes: number }) => n + w.minutes, 0)).toBe(360);
    expect(d.reward.left).toBe(240);
  });

  it('un parent ne voit jamais les enfants d’un autre parent', async () => {
    const other = await createUser(app, { id: 'u-parent-x', phone: '06556677', role: 'parent', schoolId: DEMO_SCHOOL_ID });
    expect((await get('/me/parent/children', other).expect(200)).body).toEqual([]);
    await get('/me/parent/children/s1', other).expect(404);
    await get('/me/parent/children/sm-junior', other).expect(404);
    await get('/me/parent/rewards/s1', other).expect(404);
    expect((await get('/me/parent/rewards', other).expect(200)).body).toMatchObject({ child: null, points: 0, rewards: [] });
  });

  it('rattache un enfant par code : actif tout de suite, jamais en double', async () => {
    const other = await createUser(app, { id: 'u-parent-y', phone: '06778899', role: 'parent', schoolId: null, name: 'Rose Moussavou' });
    const linked = await post('/me/parent/children/link', other, { mode: 'code', code: '219530', relation: 'tuteur' }).expect(201); // Daniel : aucun parent
    expect(linked.body.status).toBe('active');
    expect((await get('/me/parent/children', other)).body.map((k: Kid) => k.name)).toEqual(['Daniel']);
    await post('/me/parent/children/link', other, { mode: 'code', code: '219530', relation: 'tuteur' }).expect(409);
  });

  it('une demande en attente devient un rattachement quand l’école la valide', async () => {
    const other = await createUser(app, { id: 'u-parent-z', phone: '06889900', role: 'parent', schoolId: null, name: 'Tuteur Ondo' });
    const direction = await c.token('etablissement');

    // Aïcha a déjà 2 parents : la demande attend l'école
    const pending = await post('/me/parent/children/link', other, { mode: 'code', code: '482917', relation: 'tuteur' }).expect(201);
    expect(pending.body.status).toBe('pending');
    expect((await get('/me/parent/children', other)).body).toEqual([]);

    const requests = (await get('/school/link-requests', direction).expect(200)).body as { id: string; parent: string; decision: string | null }[];
    const mine = requests.find((r) => r.parent === 'Tuteur Ondo')!;
    await post(`/school/link-requests/${mine.id}/accept`, direction).expect(201);
    expect((await get('/me/parent/children', other)).body.map((k: Kid) => k.name)).toEqual(['Aïcha']);
    await post(`/school/link-requests/${mine.id}/accept`, direction).expect(404); // déjà traitée

    // un refus ne rattache rien
    const refused = await createUser(app, { id: 'u-parent-w', phone: '06990011', role: 'parent', schoolId: null, name: 'Autre Tuteur' });
    await post('/me/parent/children/link', refused, { mode: 'code', code: '482917', relation: 'tuteur' }).expect(201);
    const r2 = ((await get('/school/link-requests', direction)).body as { id: string; parent: string }[]).find((r) => r.parent === 'Autre Tuteur')!;
    await post(`/school/link-requests/${r2.id}/refuse`, direction).expect(201);
    expect((await get('/me/parent/children', refused)).body).toEqual([]);
  });

  it('les récompenses utilisent les points de l’enfant choisi', async () => {
    const parent = await c.token('parent');
    const aicha = (await get('/me/parent/rewards/s1', parent).expect(200)).body;
    const junior = (await get('/me/parent/rewards/sm-junior', parent).expect(200)).body;
    expect(aicha).toMatchObject({ child: 'Aïcha', points: 1240 });
    expect(aicha.rewards.find((r: { label: string }) => r.label === 'Un nouveau livre').reached).toBe(true);
    expect(junior).toMatchObject({ child: 'Junior', points: 0 });
    expect(junior.rewards.every((r: { reached: boolean }) => !r.reached)).toBe(true);
  });
});
