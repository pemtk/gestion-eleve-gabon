import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { DEMO_PASSWORD, type Role } from '@sge/shared';
import { client, createApp, reset } from './helpers.js';

describe('API (e2e, PostgreSQL)', () => {
  let app: INestApplication<App>;
  let c: ReturnType<typeof client>;

  beforeAll(async () => { app = await createApp(); c = client(app); });
  afterAll(() => app.close());
  beforeEach(() => reset(app));

  const api_ = () => c.api();
  const token_ = (r: Role) => c.token(r);
  const as_ = (t: string) => c.as(t);

  it('refuse les requêtes sans jeton', async () => {
    await api_().get('/dashboard/ecole').expect(401);
    await api_().get('/health').expect(200);
  });

  it('connecte par téléphone + mot de passe, et rejette un mauvais mot de passe', async () => {
    const ok = await api_().post('/auth/login').send({ mode: 'password', phone: '+241 07 12 34 56', password: DEMO_PASSWORD }).expect(201);
    expect(ok.body.user).toMatchObject({ role: 'eleve', name: 'Aïcha Ondo' });
    await api_().post('/auth/login').send({ mode: 'password', phone: '07 12 34 56', password: 'faux' }).expect(401);
  });

  it('inscrit un parent puis active son compte par OTP', async () => {
    const body = { firstName: 'Rose', lastName: 'Mba', phone: '06 99 88 77', password: 'motdepasse1' };
    await api_().post('/auth/signup').send({ ...body, password: 'court' }).expect(400);
    await api_().post('/auth/signup').send(body).expect(201);
    await api_().post('/auth/login').send({ mode: 'password', phone: body.phone, password: body.password }).expect(401); // pas encore activé
    await api_().post('/auth/otp/verify').send({ phone: body.phone, code: '000000' }).expect(401);
    const verified = await api_().post('/auth/otp/verify').send({ phone: body.phone, code: '123456' }).expect(201);
    expect(verified.body.user.role).toBe('parent');
  });

  it('cloisonne les espaces par profil', async () => {
    const parent = await token_('parent');
    const ecole = await token_('etablissement');
    await api_().get('/school/students').set(as_(parent)).expect(403);
    await api_().get('/dashboard/ecole').set(as_(parent)).expect(403);
    await api_().get('/dashboard/ecole').set(as_(ecole)).expect(200);
    await api_().get('/admin/organizations').set(as_(ecole)).expect(403);
  });

  it('applique les règles de formule et de suspension', async () => {
    const ecole = await token_('etablissement');
    const admin = await token_('admin');
    await api_().get('/dashboard/ecole/network').set(as_(ecole)).expect(403); // Standard : pas de vue réseau
    await api_().post('/school/teachers/invite').set(as_(ecole)).send({ name: 'Rachel N.', phone: '07 41 02 66' }).expect(201);

    await api_().put('/admin/subscriptions/o2').set(as_(admin)).send({ plan: 'Standard', period: 'annuelle', start: '2026-01-01', end: '2026-12-31', active: false }).expect(200);
    const blocked = await api_().post('/school/classes').set(as_(ecole)).send({ level: 'Collège', name: '6ème D', capacity: 40 }).expect(403);
    expect(blocked.body.code).toBe('SUBSCRIPTION_SUSPENDED');
    await api_().get('/school/classes').set(as_(ecole)).expect(200); // consultation seule
  });

  it('exige un motif pour corriger une note publiée', async () => {
    const ecole = await token_('etablissement');
    await api_().post('/school/results/res0/correct').set(as_(ecole)).send({ value: 16, reason: '' }).expect(400);
    const res = await api_().post('/school/results/res0/correct').set(as_(ecole)).send({ value: 16, reason: 'Erreur de saisie' }).expect(201);
    expect(res.body.value).toBe(16);
  });

  it('rattache un enfant par code ; un enfant déjà rattaché ne l’est pas deux fois', async () => {
    const parent = await token_('parent');
    await api_().post('/me/parent/children/link').set(as_(parent)).send({ mode: 'code', code: '000000', relation: 'mère' }).expect(404);
    const active = await api_().post('/me/parent/children/link').set(as_(parent)).send({ mode: 'code', code: '219530', relation: 'mère' }).expect(201);
    expect(active.body.status).toBe('active');
    await api_().post('/me/parent/children/link').set(as_(parent)).send({ mode: 'code', code: '482917', relation: 'mère' }).expect(409); // Aïcha : déjà la sienne
  });

  it('masque les petites cellules pour le partenaire', async () => {
    const partner = await token_('partenaire');
    const { body } = await api_().get('/partner/reports').set(as_(partner)).expect(200);
    expect(body.rows[1].open).toBeNull();
    await api_().get('/me/student/home').set(as_(partner)).expect(403);
  });

  it('valide la tâche d’un élève et attribue les points', async () => {
    const eleve = await token_('eleve');
    const done = await api_().post('/me/student/tasks/k1/complete').set(as_(eleve)).send({ evaluation: 'ok', proof: false, seconds: 30 }).expect(201);
    expect(done.body).toMatchObject({ gained: 20, points: 1260, flaggedForReview: true });
    await api_().post('/me/student/tasks/k1/complete').set(as_(eleve)).send({ evaluation: 'ok', seconds: 900 }).expect(400);
  });

  it('rend l’envoi de message idempotent (file hors ligne)', async () => {
    const parent = await token_('parent');
    const msg = { text: 'Bonjour', clientId: 'c-1' };
    await api_().post('/threads/th1/messages').set(as_(parent)).send(msg).expect(201);
    await api_().post('/threads/th1/messages').set(as_(parent)).send(msg).expect(201);
    const list = await api_().get('/threads/th1/messages').set(as_(parent)).expect(200);
    expect(list.body.filter((m: { id: string }) => m.id === 'c-1')).toHaveLength(1);
  });
});
