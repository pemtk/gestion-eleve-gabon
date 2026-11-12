import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DEMO_PASSWORD, type Role } from '@sge/shared';
import { AppModule } from '../src/app.module.js';

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  const api = () => request(app.getHttpServer());

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterEach(() => app.close());

  const token = async (role: Role) => (await api().post(`/auth/demo/${role}`).expect(201)).body.accessToken as string;
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('refuse les requêtes sans jeton', async () => {
    await api().get('/dashboard/ecole').expect(401);
    await api().get('/health').expect(200);
  });

  it('connecte par téléphone + mot de passe, et rejette un mauvais mot de passe', async () => {
    const ok = await api().post('/auth/login').send({ mode: 'password', phone: '+241 07 12 34 56', password: DEMO_PASSWORD }).expect(201);
    expect(ok.body.user).toMatchObject({ role: 'eleve', name: 'Aïcha Ondo' });
    await api().post('/auth/login').send({ mode: 'password', phone: '07 12 34 56', password: 'faux' }).expect(401);
  });

  it('inscrit un parent puis active son compte par OTP', async () => {
    const body = { firstName: 'Rose', lastName: 'Mba', phone: '06 99 88 77', password: 'motdepasse1' };
    await api().post('/auth/signup').send({ ...body, password: 'court' }).expect(400);
    await api().post('/auth/signup').send(body).expect(201);
    await api().post('/auth/login').send({ mode: 'password', phone: body.phone, password: body.password }).expect(401); // pas encore activé
    await api().post('/auth/otp/verify').send({ phone: body.phone, code: '000000' }).expect(401);
    const verified = await api().post('/auth/otp/verify').send({ phone: body.phone, code: '123456' }).expect(201);
    expect(verified.body.user.role).toBe('parent');
  });

  it('cloisonne les espaces par profil', async () => {
    const parent = await token('parent');
    const ecole = await token('etablissement');
    await api().get('/school/students').set(as(parent)).expect(403);
    await api().get('/dashboard/ecole').set(as(parent)).expect(403);
    await api().get('/dashboard/ecole').set(as(ecole)).expect(200);
    await api().get('/admin/organizations').set(as(ecole)).expect(403);
  });

  it('applique les règles de formule et de suspension', async () => {
    const ecole = await token('etablissement');
    const admin = await token('admin');
    await api().get('/dashboard/ecole/network').set(as(ecole)).expect(403); // Standard : pas de vue réseau
    await api().post('/school/teachers/invite').set(as(ecole)).send({ name: 'Rachel N.', phone: '07 41 02 66' }).expect(201);

    await api().put('/admin/subscriptions/o2').set(as(admin)).send({ plan: 'Standard', period: 'annuelle', start: '2026-01-01', end: '2026-12-31', active: false }).expect(200);
    const blocked = await api().post('/school/classes').set(as(ecole)).send({ level: 'Collège', name: '6ème D', capacity: 40 }).expect(403);
    expect(blocked.body.code).toBe('SUBSCRIPTION_SUSPENDED');
    await api().get('/school/classes').set(as(ecole)).expect(200); // consultation seule
  });

  it('exige un motif pour corriger une note publiée', async () => {
    const ecole = await token('etablissement');
    await api().post('/school/results/res0/correct').set(as(ecole)).send({ value: 16, reason: '' }).expect(400);
    const res = await api().post('/school/results/res0/correct').set(as(ecole)).send({ value: 16, reason: 'Erreur de saisie' }).expect(201);
    expect(res.body.value).toBe(16);
  });

  it('rattache un enfant par code et envoie les codes déjà utilisés en validation', async () => {
    const parent = await token('parent');
    await api().post('/me/parent/children/link').set(as(parent)).send({ mode: 'code', code: '000000', relation: 'mère' }).expect(404);
    const active = await api().post('/me/parent/children/link').set(as(parent)).send({ mode: 'code', code: '219530', relation: 'mère' }).expect(201);
    expect(active.body.status).toBe('active');
    const pending = await api().post('/me/parent/children/link').set(as(parent)).send({ mode: 'code', code: '482917', relation: 'tuteur' }).expect(201);
    expect(pending.body.status).toBe('pending');
  });

  it('masque les petites cellules pour le partenaire', async () => {
    const partner = await token('partenaire');
    const { body } = await api().get('/partner/reports').set(as(partner)).expect(200);
    expect(body.rows[1].open).toBeNull();
    await api().get('/me/student/home').set(as(partner)).expect(403);
  });

  it('valide la tâche d’un élève et attribue les points', async () => {
    const eleve = await token('eleve');
    const done = await api().post('/me/student/tasks/k1/complete').set(as(eleve)).send({ evaluation: 'ok', proof: false, seconds: 30 }).expect(201);
    expect(done.body).toMatchObject({ gained: 20, points: 1260, flaggedForReview: true });
    await api().post('/me/student/tasks/k1/complete').set(as(eleve)).send({ evaluation: 'ok', seconds: 900 }).expect(400);
  });

  it('rend l’envoi de message idempotent (file hors ligne)', async () => {
    const parent = await token('parent');
    const msg = { text: 'Bonjour', clientId: 'c-1' };
    await api().post('/threads/th1/messages').set(as(parent)).send(msg).expect(201);
    await api().post('/threads/th1/messages').set(as(parent)).send(msg).expect(201);
    const list = await api().get('/threads/th1/messages').set(as(parent)).expect(200);
    expect(list.body.filter((m: { id: string }) => m.id === 'c-1')).toHaveLength(1);
  });
});
