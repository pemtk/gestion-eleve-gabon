import type { INestApplication } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { App } from 'supertest/types.js';
import { vi, type MockInstance } from 'vitest';
import { DEMO_PASSWORD, DEMO_SCHOOL_ID, DEMO_USERS, SECOND_SCHOOL_DIRECTOR, SECOND_SCHOOL_ID } from '@sge/shared';
import { SmsGateway } from '../src/auth/sms.gateway.js';
import { auditLog, rateLimits, refreshTokens } from '../src/db/schema.js';
import { client, createApp, dbOf, reset } from './helpers.js';

/** Ticket #15 — limitation des tentatives, sessions courtes renouvelables et révocables, en-têtes, journal d'audit. */
describe('Sécurité de base (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let c: ReturnType<typeof client>;
  let sms: MockInstance<(phone: string, message: string) => void>;
  const phone = DEMO_USERS.etablissement.phone;
  const login = (p: string, password: string) => c.api().post('/auth/login').send({ mode: 'password', phone: p, password });
  const session = async (p = phone) => (await login(p, DEMO_PASSWORD).expect(201)).body as { accessToken: string; refreshToken: string; expiresIn: number };
  const renew = (refreshToken: string) => c.api().post('/auth/refresh').send({ refreshToken });
  const audit = (where: Partial<{ action: string; outcome: string }> = {}) => dbOf(app).select().from(auditLog).where(and(where.action ? eq(auditLog.action, where.action) : undefined, where.outcome ? eq(auditLog.outcome, where.outcome) : undefined)).orderBy(auditLog.id);

  beforeAll(async () => { app = await createApp(); c = client(app); });
  afterAll(() => app.close());
  beforeEach(async () => {
    await reset(app);
    sms = vi.spyOn(app.get(SmsGateway), 'send').mockImplementation(() => undefined) as unknown as typeof sms;
  });
  afterEach(() => sms.mockRestore());

  describe('limitation des tentatives', () => {
    it('bloque un numéro après 5 mots de passe faux, même avec le bon mot de passe ensuite', async () => {
      for (let i = 0; i < 5; i++) await login(phone, 'faux-' + i).expect(401);
      const blocked = await login(phone, DEMO_PASSWORD).expect(429);
      expect(blocked.body.code).toBe('RATE_LIMITED');
      expect(blocked.body.retryAfterSeconds).toBeGreaterThan(14 * 60);
      expect(blocked.body.message).toMatch(/Trop de tentatives/);
      await login(DEMO_USERS.parent.phone, DEMO_PASSWORD).expect(201); // les autres numéros ne sont pas touchés
      expect((await audit({ action: 'auth.locked' })).length).toBe(1);
    });

    it('un blocage échu est levé et le compteur repart de zéro', async () => {
      for (let i = 0; i < 5; i++) await login(phone, 'faux').expect(401);
      await login(phone, DEMO_PASSWORD).expect(429);
      await dbOf(app).update(rateLimits).set({ blockedUntil: sql`now() - interval '1 second'` }).where(eq(rateLimits.key, `login:phone:${phone}`));
      await login(phone, 'faux').expect(401); // un seul échec compté, pas un nouveau blocage
      await login(phone, DEMO_PASSWORD).expect(201);
      await login(phone, 'faux').expect(401); // le succès a remis le compteur à zéro
    });

    it('une connexion réussie ne bloque jamais, et 4 échecs puis un succès remettent le compteur à zéro', async () => {
      for (let i = 0; i < 4; i++) await login(phone, 'faux').expect(401);
      await login(phone, DEMO_PASSWORD).expect(201);
      for (let i = 0; i < 4; i++) await login(phone, 'faux').expect(401);
      await login(phone, DEMO_PASSWORD).expect(201);
    });

    it('limite aussi par adresse IP : le balayage de numéros est coupé', async () => {
      for (let i = 0; i < 30; i++) await login(`06${String(100000 + i)}`, 'faux').expect(401);
      await login(DEMO_USERS.parent.phone, DEMO_PASSWORD).expect(429);
    });

    it('bloque la saisie du code SMS après 10 mauvais codes, y compris le bon', async () => {
      for (let i = 0; i < 10; i++) {
        await c.api().post('/auth/otp/request').send({ phone: DEMO_USERS.parent.phone }).expect(201).catch(() => undefined);
        await c.api().post('/auth/otp/verify').send({ phone: DEMO_USERS.parent.phone, code: '000000' }).expect(401);
      }
      await c.api().post('/auth/otp/verify').send({ phone: DEMO_USERS.parent.phone, code: '123456' }).expect(429);
    });

    it('limite les demandes de SMS par numéro : la 6e demande est refusée sans envoi', async () => {
      for (let i = 0; i < 5; i++) await c.api().post('/auth/otp/request').send({ phone: DEMO_USERS.parent.phone }).expect(201);
      expect(sms).toHaveBeenCalledTimes(5);
      const refused = await c.api().post('/auth/otp/request').send({ phone: DEMO_USERS.parent.phone }).expect(429);
      expect(refused.body.code).toBe('RATE_LIMITED');
      await c.api().post('/auth/password/forgot').send({ phone: DEMO_USERS.parent.phone }).expect(429); // même quota
      expect(sms).toHaveBeenCalledTimes(5);
    });

    it('limite les essais de mot de passe actuel lors d’un changement de mot de passe', async () => {
      const { accessToken } = await session();
      for (let i = 0; i < 5; i++) await c.api().post('/auth/password/change').set(c.as(accessToken)).send({ current: 'faux', next: 'nouveaumdp1', confirm: 'nouveaumdp1' }).expect(401);
      await c.api().post('/auth/password/change').set(c.as(accessToken)).send({ current: DEMO_PASSWORD, next: 'nouveaumdp1', confirm: 'nouveaumdp1' }).expect(429);
    });
  });

  describe('sessions courtes, renouvelables et révocables', () => {
    it('le jeton d’accès dure 15 minutes', async () => {
      const s = await session();
      expect(s.expiresIn).toBe(900);
      const payload = JSON.parse(Buffer.from(s.accessToken.split('.')[1]!, 'base64url').toString()) as { iat: number; exp: number };
      expect(payload.exp - payload.iat).toBe(900);
    });

    it('un jeton expiré est refusé, le renouvellement en donne un nouveau et remplace le jeton de renouvellement', async () => {
      const s = await session();
      const next = (await renew(s.refreshToken).expect(200)).body;
      expect(next.refreshToken).not.toBe(s.refreshToken);
      expect(next.user.phone).toBe(phone);
      await c.api().get('/auth/me').set(c.as(next.accessToken)).expect(200);
      // l'ancien jeton ne sert qu'une fois (dans la seconde : simple course, pas une attaque)
      await renew(s.refreshToken).expect(401);
      await renew(next.refreshToken).expect(200);
    });

    it('rejouer un jeton déjà remplacé révoque toute la session (vol probable)', async () => {
      const s = await session();
      const next = (await renew(s.refreshToken).expect(200)).body;
      await dbOf(app).update(refreshTokens).set({ revokedAt: sql`now() - interval '1 minute'` }).where(eq(refreshTokens.id, s.refreshToken.split('.')[0]!));
      await renew(s.refreshToken).expect(401);
      await renew(next.refreshToken).expect(401); // le voleur comme la victime doivent se reconnecter
      expect((await audit({ action: 'auth.refresh.refused' })).length).toBe(2);
    });

    it('refuse un jeton inventé, altéré, expiré ou trop ancien', async () => {
      const s = await session();
      await renew('n-importe-quoi').expect(401);
      await renew(s.refreshToken.slice(0, -2) + 'xx').expect(401);
      await dbOf(app).update(refreshTokens).set({ expiresAt: sql`now() - interval '1 second'` });
      await renew(s.refreshToken).expect(401);
      const fresh = await session();
      await dbOf(app).update(refreshTokens).set({ familyStartedAt: sql`now() - interval '31 days'` }).where(eq(refreshTokens.id, fresh.refreshToken.split('.')[0]!));
      await renew(fresh.refreshToken).expect(401);
    });

    it('la déconnexion révoque le jeton de renouvellement, et seulement celui de cet appareil', async () => {
      const a = await session();
      const b = await session();
      await c.api().post('/auth/logout').send({ refreshToken: a.refreshToken }).expect(200);
      await renew(a.refreshToken).expect(401);
      await renew(b.refreshToken).expect(200);
      await c.api().post('/auth/logout').send({ refreshToken: a.refreshToken }).expect(200); // idempotent
    });

    it('« tous les appareils » révoque toutes les sessions du compte, pas celles des autres', async () => {
      const a = await session();
      const b = await session();
      const other = await session(DEMO_USERS.parent.phone);
      await c.api().post('/auth/logout-all').set(c.as(a.accessToken)).expect(200);
      await renew(a.refreshToken).expect(401);
      await renew(b.refreshToken).expect(401);
      await renew(other.refreshToken).expect(200);
    });

    it('changer le mot de passe déconnecte les autres appareils mais garde celui-ci', async () => {
      const here = await session();
      const elsewhere = await session();
      await c.api().post('/auth/password/change').set(c.as(here.accessToken)).set('X-Refresh-Token', here.refreshToken)
        .send({ current: DEMO_PASSWORD, next: 'nouveaumdp1', confirm: 'nouveaumdp1' }).expect(201);
      await renew(elsewhere.refreshToken).expect(401);
      await renew(here.refreshToken).expect(200);
      expect((await audit({ action: 'auth.password.change' })).length).toBe(1);
    });

    it('le mot de passe oublié ferme toutes les sessions', async () => {
      const s = await session();
      await c.api().post('/auth/password/forgot').send({ phone }).expect(201);
      await c.api().post('/auth/password/reset').send({ phone, code: '123456', password: 'nouveaumdp1' }).expect(201);
      await renew(s.refreshToken).expect(401);
      await login(phone, 'nouveaumdp1').expect(201);
    });

    it('un compte retiré ne peut plus renouveler sa session', async () => {
      const s = await session();
      await dbOf(app).execute(sql`UPDATE users SET activated = false WHERE phone = ${phone}`);
      await renew(s.refreshToken).expect(401);
    });
  });

  it('envoie les en-têtes de sécurité et ne révèle pas le serveur', async () => {
    const res = await c.api().get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  describe('journal d’audit des signalements confidentiels', () => {
    let a: string; // direction du Lycée Léon Mba
    let b: string; // direction du Collège Bessieux
    beforeEach(async () => {
      a = await c.token('etablissement');
      b = (await login(SECOND_SCHOOL_DIRECTOR.phone, DEMO_PASSWORD).expect(201)).body.accessToken;
    });

    it('trace chaque lecture et chaque action, avec l’utilisateur, l’école et le dossier', async () => {
      await c.api().get('/school/referent').set(c.as(a)).expect(200);
      await c.api().get('/school/cases/SC-0142').set(c.as(a)).expect(200);
      await c.api().post('/school/cases/SC-0142/acknowledge').set(c.as(a)).expect(201);
      const rows = await audit();
      expect(rows.filter((r) => r.resourceType === 'case').map((r) => [r.action, r.resourceId, r.outcome])).toEqual([
        ['case.list', null, 'ok'], ['case.read', 'SC-0142', 'ok'], ['case.acknowledge', 'SC-0142', 'ok'],
      ]);
      expect(rows.every((r) => r.userId === DEMO_USERS.etablissement.id && r.schoolId === DEMO_SCHOOL_ID)).toBe(true);
      expect(rows[1]!.ip).toBeTruthy();
    });

    it('trace aussi les tentatives refusées : dossier d’une autre école, étape invalide', async () => {
      await c.api().get('/school/cases/SC-0142').set(c.as(b)).expect(404);
      await c.api().post('/school/cases/SC-0142/acknowledge').set(c.as(b)).expect(404);
      await c.api().post('/school/cases/SC-0142/evaluate').set(c.as(a)).send({ gravity: 'Modérée', measures: 'x', informDirector: false, informFamily: false }).expect(400);
      const denied = await audit({ outcome: 'refuse' });
      expect(denied.map((r) => [r.action, r.userId, r.schoolId])).toEqual([
        ['case.read', SECOND_SCHOOL_DIRECTOR.id, SECOND_SCHOOL_ID],
        ['case.acknowledge', SECOND_SCHOOL_DIRECTOR.id, SECOND_SCHOOL_ID],
        ['case.evaluate', DEMO_USERS.etablissement.id, DEMO_SCHOOL_ID],
      ]);
    });

    it('la direction ne lit que le journal de son école ; l’administrateur voit tout ; les autres profils n’y ont pas accès', async () => {
      await c.api().get('/school/cases/SC-0142').set(c.as(a)).expect(200);
      await c.api().get('/school/cases/SC-0201').set(c.as(b)).expect(200);
      const own = (await c.api().get('/school/audit-log').set(c.as(a)).expect(200)).body as { resourceId: string; userName: string }[];
      expect(own.map((r) => r.resourceId)).toEqual(['SC-0142']);
      expect(own[0]!.userName).toBe(DEMO_USERS.etablissement.name);
      expect(((await c.api().get('/school/audit-log').set(c.as(b)).expect(200)).body as { resourceId: string }[]).map((r) => r.resourceId)).toEqual(['SC-0201']);
      const all = (await c.api().get('/admin/audit-log').set(c.as(await c.token('admin'))).expect(200)).body as unknown[];
      expect(all.length).toBeGreaterThanOrEqual(2);
      for (const role of ['enseignant', 'eleve', 'parent', 'agent'] as const) await c.api().get('/school/audit-log').set(c.as(await c.token(role))).expect(403);
      await c.api().get('/admin/audit-log').set(c.as(a)).expect(403);
    });
  });
});
