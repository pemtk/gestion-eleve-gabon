import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { DEMO_USERS, initials, isPasswordValid, type LoginInput, type Role, type SessionUser, type SignupInput } from '@sge/shared';
import type { AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { otpCodes, users } from '../db/schema.js';
import { hashPassword, verifyPassword } from './password.js';
import { SmsGateway } from './sms.gateway.js';

const OTP_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const isProd = () => process.env.NODE_ENV === 'production';
type UserRow = typeof users.$inferSelect;
const toSessionUser = (u: UserRow): SessionUser => ({ id: u.id, name: u.name, initials: u.initials, phone: u.phone, role: u.role as Role, title: u.title, organization: u.organization ?? undefined, schoolId: u.schoolId ?? undefined });

@Injectable()
export class AuthService {
  constructor(@Inject(DB) private readonly db: Db, private readonly jwt: JwtService, private readonly sms: SmsGateway) {}

  private async findByPhone(phone: string) {
    const [row] = await this.db.select().from(users).where(eq(users.phone, phone));
    return row;
  }

  private async session(user: SessionUser) {
    const payload: AuthUser = { sub: user.id, role: user.role, name: user.name, phone: user.phone, schoolId: user.schoolId ?? null };
    return { accessToken: await this.jwt.signAsync(payload), user };
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
  async requestOtpIfAccount(phone: string) {
    if (await this.findByPhone(phone)) await this.requestOtp(phone);
    return { sent: true, resendInSeconds: 60 };
  }

  async login(input: LoginInput) {
    const record = await this.findByPhone(input.phone);
    if (input.mode === 'otp') {
      if (!record) throw new UnauthorizedException('Aucun compte avec ce numéro.');
      return { otpRequired: true as const, ...(await this.requestOtp(input.phone)) };
    }
    if (!record || !record.activated || !record.passwordHash || !verifyPassword(input.password, record.passwordHash)) {
      throw new UnauthorizedException('Numéro ou mot de passe incorrect.');
    }
    return this.session(toSessionUser(record));
  }

  async verifyOtp(phone: string, code: string) {
    await this.consumeOtp(phone, code);
    const [record] = await this.db.update(users).set({ activated: true }).where(eq(users.phone, phone)).returning();
    if (!record) throw new UnauthorizedException('Aucun compte avec ce numéro.');
    return this.session(toSessionUser(record));
  }

  async signup(input: SignupInput) {
    if (await this.findByPhone(input.phone)) throw new ConflictException('Un compte existe déjà avec ce numéro.');
    const name = `${input.firstName} ${input.lastName}`;
    await this.db.insert(users).values({ id: `u-${input.phone}`, phone: input.phone, name, initials: initials(name), role: 'parent', title: 'Parent', schoolId: null, passwordHash: hashPassword(input.password), activated: false });
    return this.requestOtp(input.phone);
  }

  async forgot(phone: string) {
    // Réponse identique que le compte existe ou non (pas d'énumération de numéros).
    if (await this.findByPhone(phone)) await this.requestOtp(phone);
    return { sent: true, resendInSeconds: 60 };
  }

  async reset(phone: string, code: string, password: string) {
    if (!isPasswordValid(password)) throw new BadRequestException('Mot de passe trop faible.');
    await this.consumeOtp(phone, code);
    const done = await this.db.update(users).set({ passwordHash: hashPassword(password), activated: true }).where(eq(users.phone, phone)).returning({ id: users.id });
    if (!done.length) throw new UnauthorizedException('Aucun compte avec ce numéro.');
    return { ok: true };
  }

  async changePassword(userPhone: string, current: string, next: string) {
    const record = await this.findByPhone(userPhone);
    if (record && !record.passwordHash) throw new ForbiddenException('Ce compte n’a pas encore de mot de passe : définissez-en un.');
    if (!record || !record.passwordHash || !verifyPassword(current, record.passwordHash)) throw new UnauthorizedException('Mot de passe actuel incorrect.');
    await this.db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.phone, userPhone));
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
