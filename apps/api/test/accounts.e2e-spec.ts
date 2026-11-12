import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { App } from 'supertest/types.js';
import { vi, type MockInstance } from 'vitest';
import { SmsGateway } from '../src/auth/sms.gateway.js';
import { bootstrapAdmin, createPlatformAdmin } from '../src/db/admin.js';
import { institutionalUsers, students, teachers, userScopes, users } from '../src/db/schema.js';
import { client, createApp, dbOf, reset } from './helpers.js';

/**
 * Ticket #13 — mise en service d'une école neuve sans base de démonstration :
 * premier administrateur → école + direction → classes → enseignant et élèves → activation par code SMS.
 */
describe('Création des comptes (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let c: ReturnType<typeof client>;
  let sms: MockInstance<(phone: string, message: string) => void>;
  const login = (phone: string, password: string) => c.api().post('/auth/login').send({ mode: 'password', phone, password });
  const activate = async (phone: string) => {
    await c.api().post('/auth/otp/request').send({ phone }).expect(201);
    return (await c.api().post('/auth/otp/verify').send({ phone, code: '123456' }).expect(201)).body as { accessToken: string; user: { id: string; role: string } };
  };
  const sent = () => sms.mock.calls.map(([phone, text]) => ({ phone: String(phone), text: String(text) }));

  beforeAll(async () => { app = await createApp(); c = client(app); });
  afterAll(() => app.close());
  beforeEach(async () => {
    await reset(app);
    sms = vi.spyOn(app.get(SmsGateway), 'send').mockImplementation(() => undefined) as unknown as typeof sms;
  });
  afterEach(() => sms.mockRestore());

  describe('premier administrateur', () => {
    it('est créé par la commande, activé, et se connecte avec son mot de passe', async () => {
      const db = dbOf(app);
      await db.delete(users).where(eq(users.role, 'admin'));
      const admin = await createPlatformAdmin(db, { name: 'Équipe plateforme', phone: '+241 07 00 11 22', password: 'motdepasse1' });
      expect(admin.activated).toBe(true);
      const res = await login('07 00 11 22', 'motdepasse1').expect(201);
      expect(res.body.user.role).toBe('admin');
      await c.api().get('/admin/organizations').set(c.as(res.body.accessToken)).expect(200);
    });

    it('refuse un mot de passe faible et un numéro déjà utilisé', async () => {
      const db = dbOf(app);
      await expect(createPlatformAdmin(db, { name: 'X', phone: '07 00 11 23', password: 'court' })).rejects.toThrow(/mot de passe/i);
      await createPlatformAdmin(db, { name: 'A', phone: '07 00 11 24', password: 'motdepasse1' });
      await expect(createPlatformAdmin(db, { name: 'B', phone: '07 00 11 24', password: 'motdepasse1' })).rejects.toThrow(/existe déjà/);
    });

    it('l’amorçage au démarrage ne crée l’administrateur qu’une fois, et seulement si configuré', async () => {
      const db = dbOf(app);
      await db.delete(users).where(eq(users.role, 'admin'));
      expect(await bootstrapAdmin(db, {})).toBe(false);
      const env = { BOOTSTRAP_ADMIN_PHONE: '07 00 33 44', BOOTSTRAP_ADMIN_PASSWORD: 'motdepasse1' } as NodeJS.ProcessEnv;
      expect(await bootstrapAdmin(db, env)).toBe(true);
      expect(await bootstrapAdmin(db, env)).toBe(false);
      await login('07 00 33 44', 'motdepasse1').expect(201);
    });
  });

  it('une école neuve est mise en service de bout en bout, sans la base de démonstration', async () => {
    const admin = await c.token('admin');

    // 1. L'administrateur crée l'école avec sa direction : compte créé, SMS d'invitation envoyé.
    const created = (await c.api().post('/admin/organizations').set(c.as(admin)).send({
      type: 'École', name: 'Collège Neuf', address: 'Libreville', phone: '07 20 30 40', email: 'neuf@exemple.ga',
      director: { name: 'Marie Obame', phone: '07 20 30 41' },
    }).expect(201)).body;
    expect(created.director.phone).toBe('07203041');
    expect(sent().find((s) => s.phone === '07203041')?.text).toMatch(/Collège Neuf.*Code SMS/s);
    const [directorRow] = await dbOf(app).select().from(users).where(eq(users.phone, '07203041'));
    expect(directorRow).toMatchObject({ role: 'etablissement', schoolId: created.id, activated: false, passwordHash: null });
    await login('07 20 30 41', 'motdepasse1').expect(401); // pas de mot de passe avant l'activation

    // 2. La direction active son compte avec le code reçu, puis choisit son mot de passe.
    const dir = await activate('07 20 30 41');
    expect(dir.user.role).toBe('etablissement');
    const me = (await c.api().get('/auth/me').set(c.as(dir.accessToken)).expect(200)).body;
    expect(me.hasPassword).toBe(false);
    await c.api().post('/auth/password/change').set(c.as(dir.accessToken)).send({ current: 'x', next: 'motdepasse1', confirm: 'motdepasse1' }).expect(403);
    await c.api().post('/auth/password/set').set(c.as(dir.accessToken)).send({ next: 'motdepasse1', confirm: 'autre' }).expect(400);
    await c.api().post('/auth/password/set').set(c.as(dir.accessToken)).send({ next: 'motdepasse1', confirm: 'motdepasse1' }).expect(201);
    const relog = await login('07 20 30 41', 'motdepasse1').expect(201);
    const school = relog.body.accessToken as string;
    expect((await c.api().get('/auth/me').set(c.as(school)).expect(200)).body.hasPassword).toBe(true);

    // 3. L'école est vide : aucune donnée des autres écoles.
    expect((await c.api().get('/school/students').set(c.as(school)).expect(200)).body).toEqual([]);
    expect((await c.api().get('/school/teachers').set(c.as(school)).expect(200)).body).toEqual([]);

    // 4. Elle crée une classe ; l'administrateur lui ouvre la formule Standard (SMS inclus), puis elle invite un enseignant et crée un élève.
    const cls = (await c.api().post('/school/classes').set(c.as(school)).send({ level: 'Collège', name: '6ème A', capacity: 40 }).expect(201)).body;
    await c.api().put(`/admin/subscriptions/${created.id}`).set(c.as(admin)).send({ plan: 'Standard', period: 'annuelle', start: '2026-01-01', end: '2027-12-31', active: true }).expect(200);

    const teacher = (await c.api().post('/school/teachers/invite').set(c.as(school)).send({ name: 'Paul Mba', phone: '07 20 30 42' }).expect(201)).body;
    expect(teacher.userId).toBeUndefined(); // détail interne
    expect(sent().some((s) => s.phone === '07203042')).toBe(true);
    const { student, smsSent } = (await c.api().post('/school/students').set(c.as(school)).send({ firstName: 'Léa', lastName: 'Ndong', phone: '07 20 30 43', classId: cls.id }).expect(201)).body;
    expect(smsSent).toBe(true);
    expect(sent().some((s) => s.phone === '07203043')).toBe(true);

    // 5. Un numéro ne peut avoir qu'un compte : doublon refusé, sans fiche orpheline.
    await c.api().post('/school/teachers/invite').set(c.as(school)).send({ name: 'Autre', phone: '+241 07 20 30 42' }).expect(409);
    await c.api().post('/school/students').set(c.as(school)).send({ firstName: 'Bis', lastName: 'Ndong', phone: '07 20 30 43', classId: cls.id }).expect(409);
    expect((await c.api().get('/school/students').set(c.as(school)).expect(200)).body).toHaveLength(1);
    expect((await dbOf(app).select().from(teachers).where(eq(teachers.schoolId, created.id)))).toHaveLength(1);

    // 6. L'élève et l'enseignant activent leur compte avec le code reçu : fiche et compte sont liés.
    const st = await activate('07 20 30 43');
    expect(st.user.role).toBe('eleve');
    const [fiche] = await dbOf(app).select().from(students).where(eq(students.id, student.id));
    expect(fiche!.userId).toBe(st.user.id);
    await c.api().get('/me/student/home').set(c.as(st.accessToken)).expect(200);
    const te = await activate('07 20 30 42');
    expect(te.user.role).toBe('enseignant');
    expect((await c.api().get('/me/teacher/classes').set(c.as(te.accessToken)).expect(200)).body).toEqual([]); // pas encore d'affectation

    // 7. Renvoyer l'invitation ne prévient que les comptes pas encore activés.
    sms.mockClear();
    await c.api().post(`/school/teachers/${teacher.id}/resend`).set(c.as(school)).expect(201);
    await c.api().post(`/school/students/${student.id}/send-code`).set(c.as(school)).expect(201);
    expect(sent()).toEqual([]);
  });

  it('l’import CSV crée un compte par élève et signale les numéros déjà pris', async () => {
    const school = await c.token('etablissement');
    const csv = ['nom,prénom,téléphone,classe', 'Ondo,Anne,07 66 00 01,3ème B', 'Ondo,Luc,07 66 00 02,3ème B', 'Doublon,Zoé,07 66 00 01,3ème B', 'Pris,Eva,07 12 34 56,3ème B'].join('\n');
    const res = (await c.api().post('/school/students/import/confirm').set(c.as(school)).send({ csv }).expect(201)).body;
    expect(res.imported).toBe(2);
    expect(res.skipped).toBe(2);
    expect(res.skippedRows.map((r: { reason: string }) => r.reason).sort()).toEqual(['Numéro déjà utilisé par un autre compte', 'Numéro en double dans le fichier']);
    const rows = await dbOf(app).select().from(users).where(eq(users.phone, '07660002'));
    expect(rows[0]).toMatchObject({ role: 'eleve', activated: false });
    await activate('07 66 00 02');
  });

  it('un agent invité reçoit un compte limité aux écoles de son périmètre', async () => {
    const admin = await c.token('admin');
    await c.api().post('/admin/users/invite').set(c.as(admin)).send({ name: 'Jean Agent', phone: '07 77 00 01', role: 'agent', scopes: ['Lycée Léon Mba'] }).expect(201);
    expect(sent().some((s) => s.phone === '07770001')).toBe(true);
    const [u] = await dbOf(app).select().from(users).where(eq(users.phone, '07770001'));
    expect(u).toMatchObject({ role: 'agent', activated: false });
    expect(await dbOf(app).select().from(userScopes).where(eq(userScopes.userId, u!.id))).toHaveLength(1);
    expect((await dbOf(app).select().from(institutionalUsers).where(eq(institutionalUsers.userId, u!.id)))).toHaveLength(1);
    const agent = await activate('07 77 00 01');
    expect(agent.user.role).toBe('agent');
    expect((await c.api().get('/agent/schools').set(c.as(agent.accessToken)).expect(200)).body).toHaveLength(1);
    await c.api().post('/admin/users/invite').set(c.as(admin)).send({ name: 'Doublon', phone: '07 77 00 01', role: 'partenaire', scopes: ['Estuaire'] }).expect(409);
  });

  it('seule une école a un compte de direction', async () => {
    const admin = await c.token('admin');
    await c.api().post('/admin/organizations').set(c.as(admin)).send({ type: 'Diocèse', name: 'Diocèse X', director: { name: 'A B', phone: '07 88 00 01' } }).expect(400);
  });
});
