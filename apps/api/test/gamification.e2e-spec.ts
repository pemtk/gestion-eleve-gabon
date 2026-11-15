import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { App } from 'supertest/types.js';
import { DEMO_SCHOOL_ID, SECOND_SCHOOL_ID } from '@sge/shared';
import { badgeAwards, taskCompletions, tasks } from '../src/db/schema.js';
import { client, createApp, createUser, dbOf, reset } from './helpers.js';

const DAY = 86_400_000;
/** Il y a `n` jours, à midi (heure de Libreville) : à l'abri des changements de jour autour de minuit. */
const daysAgo = (n: number) => {
  const d = new Date(Date.now() + 3_600_000 - n * DAY);
  d.setUTCHours(11, 0, 0, 0);
  return d;
};

interface Trophies {
  points: number;
  streak: number;
  bestStreak: number;
  badges: {
    id: string;
    earned: boolean;
    earnedAt?: string;
    progress: { value: number; target: number };
  }[];
  history: { label: string; when: string; points: string }[];
}

/** Points, série et badges : calculés à partir des dates de validation des tâches (dates simulées en base). */
describe('Points, série et badges (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let c: ReturnType<typeof client>;
  let eleve: string;
  beforeAll(async () => {
    app = await createApp();
    c = client(app);
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await reset(app);
    eleve = await c.token('eleve');
  });

  const trophies = async () =>
    (await c.api().get('/me/student/trophies').set(c.as(eleve)).expect(200))
      .body as Trophies;
  const home = async () =>
    (await c.api().get('/me/student/home').set(c.as(eleve)).expect(200)).body;
  const badge = (t: Trophies, id: string) => t.badges.find((b) => b.id === id)!;

  /** Ajoute, pour Aïcha (s1), une tâche terminée il y a `ago` jours. */
  const doneDaysAgo = async (id: string, ago: number, title = id) => {
    const db = dbOf(app);
    const [model] = await db.select().from(tasks).where(eq(tasks.id, 'k1'));
    await db.insert(tasks).values({ ...model!, id, title });
    await db.insert(taskCompletions).values({
      taskId: id,
      studentId: 's1',
      status: 'done',
      seconds: 600,
      evaluation: 'ok',
      points: 20,
      completedAt: daysAgo(ago),
    });
  };
  /** Les deux tâches du jeu de démonstration (faites « aujourd'hui ») sont reculées de `ago` jours. */
  const moveDemoDone = (ago: number) =>
    Promise.all(
      ['k3', 'k6'].map((id) =>
        dbOf(app)
          .update(taskCompletions)
          .set({ completedAt: daysAgo(ago) })
          .where(eq(taskCompletions.taskId, id)),
      ),
    );

  it('la série augmente chaque jour consécutif', async () => {
    expect((await trophies()).streak).toBe(1); // k3 et k6, aujourd'hui
    await doneDaysAgo('h1', 1);
    expect((await trophies()).streak).toBe(2);
    await doneDaysAgo('h2', 2);
    await doneDaysAgo('h3', 3);
    const t = await trophies();
    expect(t.streak).toBe(4);
    expect(badge(t, 'streak-5')).toMatchObject({
      earned: false,
      progress: { value: 4, target: 5 },
    });
  });

  it('le badge « Série de 5 jours » s’obtient réellement, avec sa date', async () => {
    for (const [i, ago] of [1, 2, 3, 4].entries())
      await doneDaysAgo(`h${i}`, ago);
    const t = await trophies();
    expect(t.streak).toBe(5);
    expect(badge(t, 'streak-5').earned).toBe(true);
    expect(badge(t, 'streak-5').earnedAt).toBeTruthy();
    expect(badge(t, 'first-step').earned).toBe(true);
    expect(badge(t, 'streak-10').earned).toBe(false);
    const rows = await dbOf(app).select().from(badgeAwards);
    expect(rows.every((r) => r.schoolId === DEMO_SCHOOL_ID)).toBe(true);
  });

  it('la série se rompt après un jour manqué, mais le badge mérité reste', async () => {
    for (const [i, ago] of [1, 2, 3, 4].entries())
      await doneDaysAgo(`h${i}`, ago);
    expect(badge(await trophies(), 'streak-5').earned).toBe(true);
    await moveDemoDone(3);
    await dbOf(app)
      .delete(taskCompletions)
      .where(eq(taskCompletions.taskId, 'h0')); // plus rien hier
    await dbOf(app)
      .delete(taskCompletions)
      .where(eq(taskCompletions.taskId, 'h1'));
    const t = await trophies();
    expect(t.streak).toBe(0);
    expect(t.bestStreak).toBe(2); // il ne reste que deux jours de suite en base, mais le badge est acquis
    expect(badge(t, 'streak-5').earned).toBe(true);
  });

  it('« tâches du jour » repart à zéro le lendemain', async () => {
    expect((await home()).doneToday).toBe(2);
    await moveDemoDone(1);
    expect((await home()).doneToday).toBe(0);
    expect((await home()).streak).toBe(1); // la série d'hier est encore vivante
  });

  it('terminer une tâche attribue les nouveaux badges dans la réponse', async () => {
    await moveDemoDone(1);
    for (const [i, ago] of [2, 3, 4].entries()) await doneDaysAgo(`h${i}`, ago);
    const res = await c
      .api()
      .post('/me/student/tasks/k1/complete')
      .set(c.as(eleve))
      .send({ evaluation: 'ok', seconds: 600 })
      .expect(201);
    expect(res.body.streak).toBe(5);
    expect(res.body.newBadges.map((b: { id: string }) => b.id)).toEqual(
      expect.arrayContaining(['first-step', 'streak-5']),
    );
    // un second passage n'attribue plus rien
    const again = await trophies();
    expect(again.badges.filter((b) => b.earned).length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('l’historique liste les tâches terminées avec leur date, et l’invalidation retire les points et la série', async () => {
    await doneDaysAgo('h1', 1, 'Lecture du chapitre 2');
    const t = await trophies();
    expect(t.points).toBe(60);
    expect(t.history[0]).toMatchObject({ when: 'Aujourd’hui', points: '+20' });
    expect(
      t.history.find((h) => h.label === 'Lecture du chapitre 2'),
    ).toMatchObject({
      when: 'Hier',
      points: '+20',
    });
    const prof = await c.token('enseignant');
    await c
      .api()
      .post('/me/teacher/tasks/k3/invalidate/s1')
      .set(c.as(prof))
      .expect(201);
    expect((await trophies()).points).toBe(40);
  });

  it('un élève d’un autre établissement ne voit rien de ces badges', async () => {
    for (const [i, ago] of [1, 2, 3, 4].entries())
      await doneDaysAgo(`h${i}`, ago);
    await trophies();
    const other = await createUser(app, {
      id: 'u-eleve-b',
      phone: '06000042',
      role: 'eleve',
      schoolId: SECOND_SCHOOL_ID,
    });
    const body = (
      await c.api().get('/me/student/trophies').set(c.as(other)).expect(200)
    ).body as Trophies;
    expect(body.points).toBe(0);
    expect(body.badges).toEqual([]);
  });
});
