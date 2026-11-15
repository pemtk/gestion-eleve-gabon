import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { isPasswordValid } from '@sge/shared';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth.js';
import { LIMITS, type Limit } from '../common/rate-limiter.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword } from './password.js';
import { RefreshTokens } from './refresh-tokens.service.js';
import { AuthThrottleService } from './auth-throttle.service.js';
import { UserLookupService } from './user-lookup.service.js';
import { OtpService } from './otp.service.js';

/** Mots de passe : oubli et réinitialisation par SMS, changement, premier mot de passe d'un compte créé par l'école. */
@Injectable()
export class PasswordService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly refresh: RefreshTokens,
    private readonly audit: AuditService,
    private readonly throttle: AuthThrottleService,
    private readonly users: UserLookupService,
    private readonly otp: OtpService,
  ) {}

  async forgot(phone: string, ip?: string) {
    await this.throttle.smsQuota(phone, ip);
    // Réponse identique que le compte existe ou non (pas d'énumération de numéros).
    if (await this.users.findByPhone(phone)) await this.otp.requestOtp(phone);
    return { sent: true, resendInSeconds: 60 };
  }

  async reset(phone: string, code: string, password: string, ip?: string) {
    if (!isPasswordValid(password))
      throw new BadRequestException('Mot de passe trop faible.');
    const keys: [string, Limit][] = [
      [`otp:phone:${phone}`, LIMITS.otpVerifyPhone],
      ...(ip ? [[`otp:ip:${ip}`, LIMITS.otpVerifyIp] as [string, Limit]] : []),
    ];
    await this.throttle.guarded('otp', keys, ip, () =>
      this.otp.consumeOtp(phone, code),
    );
    const [done] = await this.db
      .update(users)
      .set({ passwordHash: hashPassword(password), activated: true })
      .where(eq(users.phone, phone))
      .returning({ id: users.id, schoolId: users.schoolId });
    if (!done) throw new UnauthorizedException('Aucun compte avec ce numéro.');
    // Mot de passe oublié = appareils peut-être compromis : toutes les sessions sont fermées.
    await this.refresh.revokeAll(done.id);
    await this.audit.record({
      action: 'auth.password.reset',
      resourceType: 'user',
      resourceId: done.id,
      userId: done.id,
      schoolId: done.schoolId,
      ip,
    });
    return { ok: true };
  }

  /** Change le mot de passe ; les autres appareils sont déconnectés (celui dont on donne le jeton de renouvellement reste connecté). */
  async changePassword(
    user: Pick<AuthUser, 'sub' | 'phone' | 'schoolId'>,
    current: string,
    next: string,
    keepRefreshToken?: string,
    ip?: string,
  ) {
    const key: [string, Limit][] = [[`pwd:${user.sub}`, LIMITS.passwordChange]];
    await this.throttle.guarded('password', key, ip, async () => {
      const record = await this.users.findByPhone(user.phone);
      if (record && !record.passwordHash)
        throw new ForbiddenException(
          'Ce compte n’a pas encore de mot de passe : définissez-en un.',
        );
      if (
        !record ||
        !record.passwordHash ||
        !verifyPassword(current, record.passwordHash)
      )
        throw new UnauthorizedException('Mot de passe actuel incorrect.');
    });
    await this.db
      .update(users)
      .set({ passwordHash: hashPassword(next) })
      .where(eq(users.phone, user.phone));
    await this.refresh.revokeAll(user.sub, keepRefreshToken);
    await this.audit.record({
      action: 'auth.password.change',
      resourceType: 'user',
      resourceId: user.sub,
      user,
      ip,
    });
    return { ok: true };
  }

  /** Premier mot de passe d'un compte créé par l'école ou l'administrateur et activé par code SMS. */
  async setPassword(phone: string, next: string) {
    const record = await this.users.findByPhone(phone);
    if (!record) throw new UnauthorizedException();
    if (record.passwordHash)
      throw new ForbiddenException(
        'Un mot de passe existe déjà : utilisez « Changer le mot de passe ».',
      );
    await this.db
      .update(users)
      .set({ passwordHash: hashPassword(next) })
      .where(eq(users.phone, phone));
    return { ok: true };
  }
}
