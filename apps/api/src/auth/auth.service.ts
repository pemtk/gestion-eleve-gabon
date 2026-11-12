import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'node:crypto';
import { DEMO_USERS, initials, isPasswordValid, type LoginInput, type Role, type SessionUser, type SignupInput } from '@sge/shared';
import { StoreService } from '../common/store.service.js';
import type { AuthUser } from '../common/auth.js';
import { hashPassword, verifyPassword } from './password.js';
import { SmsGateway } from './sms.gateway.js';

const OTP_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const isProd = () => process.env.NODE_ENV === 'production';

@Injectable()
export class AuthService {
  constructor(private readonly store: StoreService, private readonly jwt: JwtService, private readonly sms: SmsGateway) {}

  private async session(user: SessionUser) {
    const payload: AuthUser = { sub: user.id, role: user.role, name: user.name, phone: user.phone };
    return { accessToken: await this.jwt.signAsync(payload), user };
  }

  /** Hors production le code est fixe (123456) pour faciliter les démonstrations. */
  requestOtp(phone: string) {
    const code = isProd() ? String(randomInt(100000, 1000000)) : '123456';
    this.store.otps.set(phone, { code, expires: Date.now() + OTP_TTL_MS, attempts: 0 });
    this.sms.send(phone, `Votre code de vérification : ${code}`);
    return { sent: true, resendInSeconds: 60 };
  }

  private consumeOtp(phone: string, code: string) {
    const otp = this.store.otps.get(phone);
    if (!otp || otp.expires < Date.now()) throw new UnauthorizedException('Code expiré. Demandez-en un nouveau.');
    if (otp.attempts >= MAX_ATTEMPTS) throw new UnauthorizedException('Trop d’essais. Demandez un nouveau code.');
    if (otp.code !== code) {
      otp.attempts += 1;
      throw new UnauthorizedException('Code incorrect.');
    }
    this.store.otps.delete(phone);
  }

  async login(input: LoginInput) {
    const record = this.store.users.get(input.phone);
    if (input.mode === 'otp') {
      if (!record) throw new UnauthorizedException('Aucun compte avec ce numéro.');
      return { otpRequired: true as const, ...this.requestOtp(input.phone) };
    }
    if (!record || !record.activated || !verifyPassword(input.password, record.passwordHash)) {
      throw new UnauthorizedException('Numéro ou mot de passe incorrect.');
    }
    return this.session(record.user);
  }

  async verifyOtp(phone: string, code: string) {
    this.consumeOtp(phone, code);
    const record = this.store.users.get(phone);
    if (!record) throw new UnauthorizedException('Aucun compte avec ce numéro.');
    record.activated = true;
    return this.session(record.user);
  }

  signup(input: SignupInput) {
    if (this.store.users.has(input.phone)) throw new ConflictException('Un compte existe déjà avec ce numéro.');
    const name = `${input.firstName} ${input.lastName}`;
    const user: SessionUser = { id: `u-${input.phone}`, name, initials: initials(name), phone: input.phone, role: 'parent', title: 'Parent' };
    this.store.users.set(input.phone, { user, passwordHash: hashPassword(input.password), activated: false });
    return this.requestOtp(input.phone);
  }

  forgot(phone: string) {
    // Réponse identique que le compte existe ou non (pas d'énumération de numéros).
    if (this.store.users.has(phone)) this.requestOtp(phone);
    return { sent: true, resendInSeconds: 60 };
  }

  reset(phone: string, code: string, password: string) {
    if (!isPasswordValid(password)) throw new BadRequestException('Mot de passe trop faible.');
    this.consumeOtp(phone, code);
    const record = this.store.users.get(phone);
    if (!record) throw new UnauthorizedException('Aucun compte avec ce numéro.');
    record.passwordHash = hashPassword(password);
    return { ok: true };
  }

  changePassword(userPhone: string, current: string, next: string) {
    const record = this.store.users.get(userPhone);
    if (!record || !verifyPassword(current, record.passwordHash)) throw new UnauthorizedException('Mot de passe actuel incorrect.');
    record.passwordHash = hashPassword(next);
    return { ok: true };
  }

  me(phone: string): SessionUser {
    const record = this.store.users.get(phone);
    if (!record) throw new UnauthorizedException();
    return record.user;
  }

  /** Connexion de démonstration (désactivée en production). */
  demo(role: Role) {
    if (isProd()) throw new UnauthorizedException();
    return this.session(DEMO_USERS[role]);
  }
}
