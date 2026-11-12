import type { INestApplication } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { App } from 'supertest/types.js';
import { DEMO_PASSWORD, DEMO_SCHOOL_ID, DEMO_USERS, SECOND_SCHOOL_DIRECTOR, SECOND_SCHOOL_ID } from '@sge/shared';
import { hashPassword } from '../src/auth/password.js';
import { tasks, userScopes, users } from '../src/db/schema.js';
import { client, createApp, dbOf, reset } from './helpers.js';

/**
 * Cloisonnement entre établissements : deux écoles (Lycée Léon Mba = o2, Collège Bessieux = o6) partagent la
 * même base ; aucune ne doit voir ni modifier les données de l'autre, quel que soit l'identifiant demandé.
 */
describe('Isolation entre établissements', () => {
  let app: INestApplication<App>;
  let c: ReturnType<typeof client>;
  let a: string; // direction du Lycée Léon Mba
  let b: string; // direction du Collège Bessieux

  beforeAll(async () => { app = await createApp(); c = client(app); });
  afterAll(() => app.close());
  beforeEach(async () => {
    await reset(app);
    a = await c.token('etablissement');
    const res = await c.api().post('/auth/login').send({ mode: 'password', phone: SECOND_SCHOOL_DIRECTOR.phone, password: DEMO_PASSWORD }).expect(201);
    b = res.body.accessToken;
  });
  const get = (path: string, t: string) => c.api().get(path).set(c.as(t));
  const post = (path: string, t: string, body?: object) => c.api().post(path).set(c.as(t)).send(body);

  it('chaque direction ne voit que son établissement', async () => {
    expect((await get('/school/profile', a).expect(200)).body.name).toBe('Lycée Léon Mba');
    expect((await get('/school/profile', b).expect(200)).body.name).toBe('Collège Bessieux');

    // pastilles de la barre latérale propres à chaque école
    expect((await get('/school/profile', a)).body.badges).toEqual({ users: 3, absences: 1, cases: 3 });
    expect((await get('/school/profile', b)).body.badges).toEqual({ users: 0, absences: 1, cases: 1 });

    const studentsA = (await get('/school/students', a).expect(200)).body.map((s: { id: string }) => s.id);
    const studentsB = (await get('/school/students', b).expect(200)).body.map((s: { id: string }) => s.id);
    expect(studentsA).toContain('s1');
    expect(studentsA).not.toContain('bs1');
    expect(studentsB.sort()).toEqual(['bs1', 'bs2']);

    for (const path of ['classes', 'teachers', 'absences', 'announcements', 'link-requests', 'assignments']) {
      const ra = (await get(`/school/${path}`, a).expect(200)).body as { id: string }[];
      const rb = (await get(`/school/${path}`, b).expect(200)).body as { id: string }[];
      const idsA = new Set(ra.map((x) => x.id));
      expect(rb.filter((x) => idsA.has(x.id))).toEqual([]); // aucune ligne commune
    }
    expect((await get('/school/classes', b)).body.map((x: { name: string }) => x.name).sort()).toEqual(['5ème A', '6ème A']);
    expect((await get('/school/referent', b)).body.cases.map((x: { id: string }) => x.id)).toEqual(['SC-0201']);
    expect((await get('/school/referent', a)).body.cases.map((x: { id: string }) => x.id)).not.toContain('SC-0201');
  });

  it('une ressource d’une autre école est introuvable (404), en lecture comme en écriture', async () => {
    // B tente d'agir sur des ressources de A
    await post('/school/students/s1/regenerate-code', b).expect(404);
    await post('/school/students/s1/send-code', b).expect(403); // formule Essentiel : refusé avant même de chercher
    const absenceA = (await get('/school/absences', a)).body[0].id;
    const absenceB = (await get('/school/absences', b)).body[0].id;
    const gradeA = (await get('/school/results', a)).body.rows.find((r: { id: string | null }) => r.id).id;
    await c.api().patch(`/school/absences/${absenceA}`).set(c.as(b)).send({ status: 'P' }).expect(404);
    await post(`/school/results/${gradeA}/correct`, b, { value: 1, reason: 'tentative' }).expect(404);
    await post('/school/teachers/t3/resend', b).expect(404);
    await post('/school/link-requests/r1/accept', b).expect(404);
    await get('/school/cases/SC-0142', b).expect(404);
    await post('/school/cases/SC-0142/acknowledge', b).expect(404);
    // …et A sur celles de B
    await post('/school/students/bs1/regenerate-code', a).expect(404);
    await c.api().patch(`/school/absences/${absenceB}`).set(c.as(a)).send({ status: 'P' }).expect(404);
    await get('/school/cases/SC-0201', a).expect(404);
    await post('/school/cases/SC-0201/acknowledge', a).expect(404);

    // rien n'a bougé
    expect((await get('/school/cases/SC-0142', a)).body.state.step).toBe(1);
    expect((await get('/school/cases/SC-0201', b)).body.state.step).toBe(1);
  });

  it('une classe ne peut pas être utilisée par une autre école', async () => {
    // B tente d'inscrire un élève dans la classe 3ème B de A
    await post('/school/students', b, { lastName: 'X', firstName: 'Y', phone: '07 00 00 00', classId: '3b' }).expect(404);
    const ok = await post('/school/students', b, { lastName: 'Ndong', firstName: 'Paul', phone: '07 11 22 33', classId: 'b6a' }).expect(201);
    expect(ok.body.student.schoolId).toBe(SECOND_SCHOOL_ID);
    // l'import CSV de B ne connaît pas les classes de A
    const csv = 'nom,prénom,téléphone,classe\nMba,Léa,07 11 22 33,3ème B\nMba,Eva,07 11 22 34,6ème A';
    const preview = (await post('/school/students/import/preview', b, { csv }).expect(201)).body;
    expect(preview.rows.map((r: { error?: string }) => r.error)).toEqual(['Classe inconnue', undefined]);
  });

  it('le nom d’une classe est unique par école, pas sur toute la plateforme', async () => {
    await post('/school/classes', b, { level: 'Collège', name: '3ème B', capacity: 40 }).expect(201); // existe déjà chez A : permis
    await post('/school/classes', a, { level: 'Collège', name: '3ème B', capacity: 40 }).expect(409); // doublon chez A
  });

  it('chaque école a son propre abonnement', async () => {
    const admin = await c.token('admin');
    // B est en formule Essentiel : pas d'invitation SMS ; A (Standard) oui
    expect((await post('/school/teachers/invite', b, { name: 'Test B', phone: '07 00 00 01' }).expect(403)).body.code).toBe('PLAN_REQUIRED');
    await post('/school/teachers/invite', a, { name: 'Test A', phone: '07 00 00 02' }).expect(201);
    expect((await get('/dashboard/ecole', b).expect(200)).body.statsLocked).toBe(true);
    expect((await get('/dashboard/ecole', a).expect(200)).body.statsLocked).toBe(false);

    // suspendre B ne bloque pas A
    await c.api().put(`/admin/subscriptions/${SECOND_SCHOOL_ID}`).set(c.as(admin)).send({ plan: 'Essentiel', period: 'annuelle', start: '2026-01-01', end: '2026-12-31', active: false }).expect(200);
    expect((await post('/school/classes', b, { level: 'Collège', name: '4ème Z', capacity: 40 }).expect(403)).body.code).toBe('SUBSCRIPTION_SUSPENDED');
    await post('/school/classes', a, { level: 'Collège', name: '4ème Z', capacity: 40 }).expect(201);

    // une demande de formule de B n'apparaît que pour B, et l'administrateur la traite par école
    await c.api().put(`/admin/subscriptions/${SECOND_SCHOOL_ID}`).set(c.as(admin)).send({ plan: 'Essentiel', period: 'annuelle', start: '2026-01-01', end: '2026-12-31', active: true }).expect(200);
    await post('/school/subscription/request', b, { plan: 'Réseau' }).expect(201);
    expect((await get('/school/subscription', a)).body.requestedPlan).toBeNull();
    expect((await get('/school/subscription', b)).body.requestedPlan).toBe('Réseau');
    const requests = (await get('/admin/subscriptions', admin)).body.requests;
    expect(requests).toEqual([{ organizationId: SECOND_SCHOOL_ID, organization: 'Collège Bessieux', from: 'Essentiel', to: 'Réseau' }]);
    await post(`/admin/subscriptions/${SECOND_SCHOOL_ID}/request/apply`, admin).expect(201);
    expect((await get('/school/subscription', b)).body.plan).toBe('Réseau');
    expect((await get('/school/subscription', a)).body.plan).toBe('Standard');
    await post(`/admin/subscriptions/${DEMO_SCHOOL_ID}/request/apply`, admin).expect(404); // A n'a rien demandé
  });

  it('le référent vie scolaire est propre à chaque école', async () => {
    expect((await get('/school/referent', a)).body.confidentialEnabled).toBe(true);
    expect((await get('/school/referent', b)).body).toMatchObject({ referent: null, confidentialEnabled: false });
    await c.api().put('/school/referent').set(c.as(b)).send({ name: 'Joël Mba', confirmed: true }).expect(200);
    expect((await get('/school/referent', a)).body.referent.name).toBe('Rosine Mba');
    expect((await get('/school/referent', b)).body.referent.name).toBe('Joël Mba');
  });

  it('les profils scolaires (élève, enseignant) restent dans leur établissement', async () => {
    const db = dbOf(app);
    await db.insert(tasks).values({ id: 'task-b', schoolId: SECOND_SCHOOL_ID, classId: 'b6a', title: 'Tâche du Collège Bessieux', subject: 'Français', type: 'Cours', due: 'Demain' });
    const eleve = await c.token('eleve'); // élève du Lycée Léon Mba
    const prof = await c.token('enseignant');

    const list = (await get('/me/student/tasks', eleve).expect(200)).body.tasks.map((t: { id: string }) => t.id);
    expect(list).not.toContain('task-b');
    await get('/me/student/tasks/task-b', eleve).expect(404);
    await post('/me/student/tasks/task-b/complete', eleve, { evaluation: 'ok', seconds: 300 }).expect(404);
    await get('/me/teacher/tasks/task-b/follow-up', prof).expect(404);
    await post('/me/teacher/tasks/task-b/invalidate/bs1', prof).expect(404);

    // une tâche créée par l'enseignant de A est rattachée à A
    const created = (await post('/me/teacher/tasks', prof, { classId: '3b', subject: 'Maths', type: 'Cours', title: 'Chapitre 4', description: '', due: 'Demain' }).expect(201)).body;
    const [row] = await db.select().from(tasks).where(eq(tasks.id, created.task.id));
    expect(row!.schoolId).toBe(DEMO_SCHOOL_ID);
  });

  it('les messages sont limités à l’établissement ET au profil', async () => {
    const db = dbOf(app);
    // un parent d'une autre école se connecte : il ne voit aucune conversation de A, même en devinant l'identifiant
    await db.insert(users).values({ id: 'u-parent-b', phone: '06998877', name: 'Parent Bessieux', initials: 'PB', role: 'parent', title: 'Parent', passwordHash: hashPassword(DEMO_PASSWORD), activated: true, schoolId: SECOND_SCHOOL_ID });
    const parentB = (await c.api().post('/auth/login').send({ mode: 'password', phone: '06998877', password: DEMO_PASSWORD }).expect(201)).body.accessToken;
    expect((await get('/threads', parentB).expect(200)).body).toEqual([]);
    await get('/threads/th1/messages', parentB).expect(404);
    await post('/threads/th1/messages', parentB, { text: 'intrusion', clientId: 'x-1' }).expect(404);
    // le parent de A voit toujours son fil
    const parentA = await c.token('parent');
    expect((await get('/threads/th1/messages', parentA).expect(200)).body.map((m: { text: string }) => m.text)).not.toContain('intrusion');
  });

  it('les préférences, récompenses et lectures de notifications sont personnelles', async () => {
    const db = dbOf(app);
    await db.insert(users).values({ id: 'u-parent-2', phone: '06112233', name: 'Autre Parent', initials: 'AP', role: 'parent', title: 'Parent', passwordHash: hashPassword(DEMO_PASSWORD), activated: true, schoolId: DEMO_SCHOOL_ID });
    const other = (await c.api().post('/auth/login').send({ mode: 'password', phone: '06112233', password: DEMO_PASSWORD }).expect(201)).body.accessToken;
    const parent = await c.token('parent');

    expect((await get('/me/parent/rewards', other)).body.rewards).toEqual([]); // les récompenses du parent démo ne fuient pas
    expect((await get('/me/parent/rewards', parent)).body.rewards).toHaveLength(3);

    await c.api().put('/me/parent/alert-prefs').set(c.as(other)).send([{ id: 'a1', on: false }]).expect(200);
    const prefsParent = (await get('/me/parent/alerts', parent)).body.prefs;
    expect(prefsParent.find((p: { id: string }) => p.id === 'a1').on).toBe(true); // inchangé pour l'autre parent

    await post('/notifications/read-all', parent).expect(201);
    expect((await get('/notifications', other)).body.every((n: { read: boolean }) => !n.read)).toBe(true);
  });

  it('l’agent ne voit que les écoles de son périmètre', async () => {
    const agent = await c.token('agent');
    const db = dbOf(app);
    const names = (await get('/agent/schools', agent).expect(200)).body.map((s: { name: string }) => s.name);
    expect(names).toContain('Collège Bessieux');

    await db.delete(userScopes).where(and(eq(userScopes.userId, DEMO_USERS.agent.id), eq(userScopes.orgId, SECOND_SCHOOL_ID)));
    const after = (await get('/agent/schools', agent).expect(200)).body.map((s: { name: string }) => s.name);
    expect(after).not.toContain('Collège Bessieux');
    await get('/agent/schools/Collège%20Bessieux', agent).expect(404);
    await post('/agent/reports', agent, { schoolId: 'Collège Bessieux', date: '2026-11-10', observations: 'hors périmètre' }).expect(404);
    await post('/agent/reports', agent, { schoolId: 'Lycée Léon Mba', date: '2026-11-10', observations: 'dans le périmètre' }).expect(201);
  });

  it('les profils sans établissement ne peuvent pas accéder aux données scolaires', async () => {
    for (const role of ['agent', 'partenaire', 'admin'] as const) {
      await get('/school/students', await c.token(role)).expect(403);
    }
  });
});
