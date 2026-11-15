import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DEMO_USERS,
  initials,
  type LoginInput,
  type Role,
  type SignupInput,
} from '@sge/shared';
import { LIMITS, type Limit } from '../common/rate-limiter.js';
import { DB, type Db } from '../db/db.module.js';
import { students, users } from '../db/schema.js';
import { hashPassword, verifyPassword } from './password.js';
import { AuthThrottleService } from './auth-throttle.service.js';
import { UserLookupService } from './user-lookup.service.js';
import { OtpService } from './otp.service.js';
import { AuthSessionService } from './auth-session.service.js';
import { toSessionUser, isProd } from './auth.shared.js';

/** Haché factice : vérifié quand le numéro n'a pas de compte, pour que le temps de réponse ne révèle pas son existence. */
const DUMMY_HASH = hashPassword('motdepasse-factice-1');

/** Connexion par mot de passe ou par code SMS, activation d'un compte, inscription d'un parent et accès de démonstration. */
@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly throttle: AuthThrottleService,
    private readonly users: UserLookupService,
    private readonly otp: OtpService,
    private readonly sessions: AuthSessionService,
  ) {}

  /** Demande de code depuis l'écran « Activer mon compte » : un SMS n'est envoyé que si le numéro a un compte (réponse identique sinon). */
  async requestOtpIfAccount(phone: string, ip?: string) {
    await this.throttle.smsQuota(phone, ip);
    if (await this.users.findByPhone(phone)) await this.otp.requestOtp(phone);
    return { sent: true, resendInSeconds: 60 };
  }

  async login(input: LoginInput, ip?: string) {
    if (input.mode === 'otp') {
      await this.throttle.smsQuota(input.phone, ip);
      if (!(await this.users.findByPhone(input.phone)))
        throw new UnauthorizedException('Aucun compte avec ce numéro.');
      return {
        otpRequired: true as const,
        ...(await this.otp.requestOtp(input.phone)),
      };
    }
    const keys: [string, Limit][] = [
      [`login:phone:${input.phone}`, LIMITS.loginPhone],
      ...(ip ? [[`login:ip:${ip}`, LIMITS.loginIp] as [string, Limit]] : []),
    ];
    const record = await this.throttle.guarded('login', keys, ip, async () => {
      const r = await this.users.findByPhone(input.phone);
      // Même réponse et même travail (vérification du mot de passe) que le compte existe ou non.
      const matches = verifyPassword(
        input.password,
        r?.passwordHash ?? DUMMY_HASH,
      );
      if (!r || !r.activated || !r.passwordHash || !matches)
        throw new UnauthorizedException('Numéro ou mot de passe incorrect.');
      return r;
    });
    return this.sessions.session(toSessionUser(record));
  }

  async verifyOtp(phone: string, code: string, ip?: string) {
    const keys: [string, Limit][] = [
      [`otp:phone:${phone}`, LIMITS.otpVerifyPhone],
      ...(ip ? [[`otp:ip:${ip}`, LIMITS.otpVerifyIp] as [string, Limit]] : []),
    ];
    await this.throttle.guarded('otp', keys, ip, () =>
      this.otp.consumeOtp(phone, code),
    );
    const [record] = await this.db
      .update(users)
      .set({ activated: true })
      .where(eq(users.phone, phone))
      .returning();
    if (!record)
      throw new UnauthorizedException('Aucun compte avec ce numéro.');
    // La fiche élève suit l'état de son compte (indicateurs d'activation).
    await this.db
      .update(students)
      .set({ activated: true })
      .where(eq(students.userId, record.id));
    return this.sessions.session(toSessionUser(record));
  }

  async signup(input: SignupInput, ip?: string) {
    if (await this.users.findByPhone(input.phone))
      throw new ConflictException('Un compte existe déjà avec ce numéro.');
    await this.throttle.smsQuota(input.phone, ip);
    const name = `${input.firstName} ${input.lastName}`;
    await this.db.insert(users).values({
      id: `u-${input.phone}`,
      phone: input.phone,
      name,
      initials: initials(name),
      role: 'parent',
      title: 'Parent',
      schoolId: null,
      passwordHash: hashPassword(input.password),
      activated: false,
    });
    return this.otp.requestOtp(input.phone);
  }

  /** Connexion de démonstration (désactivée en production). */
  async demo(role: Role) {
    if (isProd()) throw new UnauthorizedException();
    return this.sessions.session(await this.users.me(DEMO_USERS[role].phone));
  }
}
