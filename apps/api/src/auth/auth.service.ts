import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { DEMO_USERS, initials, isPasswordValid, type LoginInput, type Role, type SessionUser, type SignupInput } from '@sge/shared';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth.js';
import { LIMITS, RateLimiter, type Limit } from '../common/rate-limiter.js';
import { DB, type Db } from '../db/db.module.js';
import { otpCodes, users } from '../db/schema.js';
import { hashPassword, verifyPassword } from './password.js';
import { ACCESS_TTL_SECONDS, RefreshTokens } from './refresh-tokens.service.js';
import { SmsGateway } from './sms.gateway.js';

/** Haché factice : vérifié quand le numéro n'a pas de compte, pour que le temps de réponse ne révèle pas son existence. */
const DUMMY_HASH = hashPassword('motdepasse-factice-1');
const OTP_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const isProd = () => process.env.NODE_ENV === 'production';
type UserRow = typeof users.$inferSelect;
const toSessionUser = (u: UserRow): SessionUser => ({ id: u.id, name: u.name, initials: u.initials, phone: u.phone, role: u.role as Role, title: u.title, organization: u.organization ?? undefined, schoolId: u.schoolId ?? undefined });

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db, private readonly jwt: JwtService, private readonly sms: SmsGateway,
    private readonly limiter: RateLimiter, private readonly refresh: RefreshTokens, private readonly audit: AuditService,
  ) {}

  /** Compte un échec sous plusieurs clés ; la première fois qu'une clé se bloque, l'événement est tracé. */
  private async fail(kind: string, keys: [string, Limit][], ip?: string) {
    for (const [key, limit] of keys) {
      const { count } = await this.limiter.hit(key, limit);
      if (count === limit.max) await this.audit.record({ action: 'auth.locked', resourceType: 'auth', resourceId: kind, outcome: 'refuse', ip, details: { key: key.split(':').slice(0, 2).join(':') } });
    }
  }

  /** Exécute une vérification à essais limités : refuse d'emblée si bloqué, compte l'échec, efface les compteurs au succès. */
  private async guarded<T>(kind: string, keys: [string, Limit][], ip: string | undefined, fn: () => Promise<T>): Promise<T> {
    await this.limiter.check(...keys.map(([k]) => k));
    try {
      const result = await fn();
      await this.limiter.reset(...keys.filter(([k]) => !k.includes(':ip:')).map(([k]) => k));
      return result;
    } catch (e) {
      if (e instanceof UnauthorizedException) await this.fail(kind, keys, ip);
      throw e;
    }
  }

  /** Quota d'envoi de SMS (par numéro et par adresse IP) : la demande qui dépasse est refusée avant tout envoi. */
  private async smsQuota(phone: string, ip?: string) {
    const keys: [string, Limit][] = [[`sms:phone:${phone}`, LIMITS.smsPhone], ...(ip ? [[`sms:ip:${ip}`, LIMITS.smsIp] as [string, Limit]] : [])];
    await this.limiter.check(...keys.map(([k]) => k));
    for (const [key, limit] of keys) await this.limiter.hit(key, limit);
  }

  private async findByPhone(phone: string) {
    const [row] = await this.db.select().from(users).where(eq(users.phone, phone));
    return row;
  }

  private async session(user: SessionUser) {
    const payload: AuthUser = { sub: user.id, role: user.role, name: user.name, phone: user.phone, schoolId: user.schoolId ?? null };
    const { token } = await this.refresh.issue(user.id);
    return { accessToken: await this.jwt.signAsync(payload), refreshToken: token, expiresIn: ACCESS_TTL_SECONDS, user };
  }

  /** Hors production le code est fixe (123456) pour faciliter les démonstrations. */
  async requestOtp(phone: string) {
    const code = isProd() ? String(randomInt(100000, 1000000)) : '123456';
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.db.insert(otpCodes).values({ phone, code, expiresAt, attempts: 0 }).onConflictDoUpdate({ target: otpCodes.phone, set: { code, expiresAt, attempts: 0 } });
    this.sms.send(phone, `Votre code de vérification : ${code}`);
    return { sent: true, resendInSeconds: 60 };
  }

  private async consumeOtp(phone: string, code: string) {
    const [otp] = await this.db.select().from(otpCodes).where(eq(otpCodes.phone, phone));
    if (!otp || otp.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Code expiré. Demandez-en un nouveau.');
    if (otp.attempts >= MAX_ATTEMPTS) throw new UnauthorizedException('Trop d’essais. Demandez un nouveau code.');
    if (otp.code !== code) {
      await this.db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.phone, phone));
      throw new UnauthorizedException('Code incorrect.');
    }
    await this.db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  }

  /** Demande de code depuis l'écran « Activer mon compte » : un SMS n'est envoyé que si le numéro a un compte (réponse identique sinon). */
  async requestOtpIfAccount(phone: string, ip?: string) {
    await this.smsQuota(phone, ip);
    if (await this.findByPhone(phone)) await this.requestOtp(phone);
    return { sent: true, resendInSeconds: 60 };
  }

  async login(input: LoginInput, ip?: string) {
    if (input.mode === 'otp') {
      await this.smsQuota(input.phone, ip);
      if (!(await this.findByPhone(input.phone))) throw new UnauthorizedException('Aucun compte avec ce numéro.');
      return { otpRequired: true as const, ...(await this.requestOtp(input.phone)) };
    }
    const keys: [string, Limit][] = [[`login:phone:${input.phone}`, LIMITS.loginPhone], ...(ip ? [[`login:ip:${ip}`, LIMITS.loginIp] as [string, Limit]] : [])];
    const record = await this.guarded('login', keys, ip, async () => {
      const r = await this.findByPhone(input.phone);
      // Même réponse et même travail (vérification du mot de passe) que le compte existe ou non.
      const matches = verifyPassword(input.password, r?.passwordHash ?? DUMMY_HASH);
      if (!r || !r.activated || !r.passwordHash || !matches) throw new UnauthorizedException('Numéro ou mot de passe incorrect.');
      return r;
    });
    return this.session(toSessionUser(record));
  }

  async verifyOtp(phone: string, code: string, ip?: string) {
    const keys: [string, Limit][] = [[`otp:phone:${phone}`, LIMITS.otpVerifyPhone], ...(ip ? [[`otp:ip:${ip}`, LIMITS.otpVerifyIp] as [string, Limit]] : [])];
    await this.guarded('otp', keys, ip, () => this.consumeOtp(phone, code));
    const [record] = await this.db.update(users).set({ activated: true }).where(eq(users.phone, phone)).returning();
    if (!record) throw new UnauthorizedException('Aucun compte avec ce numéro.');
    return this.session(toSessionUser(record));
  }

  async signup(input: SignupInput, ip?: string) {
    if (await this.findByPhone(input.phone)) throw new ConflictException('Un compte existe déjà avec ce numéro.');
    await this.smsQuota(input.phone, ip);
    const name = `${input.firstName} ${input.lastName}`;
    await this.db.insert(users).values({ id: `u-${input.phone}`, phone: input.phone, name, initials: initials(name), role: 'parent', title: 'Parent', schoolId: null, passwordHash: hashPassword(input.password), activated: false });
    return this.requestOtp(input.phone);
  }

  async forgot(phone: string, ip?: string) {
    await this.smsQuota(phone, ip);
    // Réponse identique que le compte existe ou non (pas d'énumération de numéros).
    if (await this.findByPhone(phone)) await this.requestOtp(phone);
    return { sent: true, resendInSeconds: 60 };
  }

  async reset(phone: string, code: string, password: string, ip?: string) {
    if (!isPasswordValid(password)) throw new BadRequestException('Mot de passe trop faible.');
    const keys: [string, Limit][] = [[`otp:phone:${phone}`, LIMITS.otpVerifyPhone], ...(ip ? [[`otp:ip:${ip}`, LIMITS.otpVerifyIp] as [string, Limit]] : [])];
    await this.guarded('otp', keys, ip, () => this.consumeOtp(phone, code));
    const [done] = await this.db.update(users).set({ passwordHash: hashPassword(password), activated: true }).where(eq(users.phone, phone)).returning({ id: users.id, schoolId: users.schoolId });
    if (!done) throw new UnauthorizedException('Aucun compte avec ce numéro.');
    // Mot de passe oublié = appareils peut-être compromis : toutes les sessions sont fermées.
    await this.refresh.revokeAll(done.id);
    await this.audit.record({ action: 'auth.password.reset', resourceType: 'user', resourceId: done.id, userId: done.id, schoolId: done.schoolId, ip });
    return { ok: true };
  }

  /** Change le mot de passe ; les autres appareils sont déconnectés (celui dont on donne le jeton de renouvellement reste connecté). */
  async changePassword(user: Pick<AuthUser, 'sub' | 'phone' | 'schoolId'>, current: string, next: string, keepRefreshToken?: string, ip?: string) {
    const key: [string, Limit][] = [[`pwd:${user.sub}`, LIMITS.passwordChange]];
    await this.guarded('password', key, ip, async () => {
      const record = await this.findByPhone(user.phone);
      if (record && !record.passwordHash) throw new ForbiddenException('Ce compte n’a pas encore de mot de passe : définissez-en un.');
      if (!record || !record.passwordHash || !verifyPassword(current, record.passwordHash)) throw new UnauthorizedException('Mot de passe actuel incorrect.');
    });
    await this.db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.phone, user.phone));
    await this.refresh.revokeAll(user.sub, keepRefreshToken);
    await this.audit.record({ action: 'auth.password.change', resourceType: 'user', resourceId: user.sub, user, ip });
    return { ok: true };
  }

  /** Premier mot de passe d'un compte créé par l'école ou l'administrateur et activé par code SMS. */
  async setPassword(phone: string, next: string) {
    const record = await this.findByPhone(phone);
    if (!record) throw new UnauthorizedException();
    if (record.passwordHash) throw new ForbiddenException('Un mot de passe existe déjà : utilisez « Changer le mot de passe ».');
    await this.db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.phone, phone));
    return { ok: true };
  }

  async hasPassword(phone: string): Promise<boolean> {
    return !!(await this.findByPhone(phone))?.passwordHash;
  }

  /** Renouvelle la session : nouveau jeton d'accès + nouveau jeton de renouvellement (l'ancien est invalidé). */
  async renew(refreshToken: string, ip?: string) {
    let rotated: { userId: string; token: string };
    try {
      rotated = await this.refresh.rotate(refreshToken);
    } catch (e) {
      await this.audit.record({ action: 'auth.refresh.refused', resourceType: 'auth', outcome: 'refuse', ip });
      throw e;
    }
    const [record] = await this.db.select().from(users).where(eq(users.id, rotated.userId));
    if (!record || !record.activated) { await this.refresh.revoke(rotated.token); throw new UnauthorizedException('Session expirée, reconnectez-vous.'); }
    const user = toSessionUser(record);
    const payload: AuthUser = { sub: user.id, role: user.role, name: user.name, phone: user.phone, schoolId: user.schoolId ?? null };
    return { accessToken: await this.jwt.signAsync(payload), refreshToken: rotated.token, expiresIn: ACCESS_TTL_SECONDS, user };
  }

  async logout(refreshToken: string) {
    await this.refresh.revoke(refreshToken);
    return { ok: true };
  }

  async logoutAll(user: Pick<AuthUser, 'sub' | 'schoolId'>, ip?: string) {
    await this.refresh.revokeAll(user.sub);
    await this.audit.record({ action: 'auth.logout_all', resourceType: 'user', resourceId: user.sub, user, ip });
    return { ok: true };
  }

  async me(phone: string): Promise<SessionUser> {
    const record = await this.findByPhone(phone);
    if (!record) throw new UnauthorizedException();
    return toSessionUser(record);
  }

  /** Connexion de démonstration (désactivée en production). */
  async demo(role: Role) {
    if (isProd()) throw new UnauthorizedException();
    return this.session(await this.me(DEMO_USERS[role].phone));
  }
}
