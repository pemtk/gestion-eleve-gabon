import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { DB, type Db } from '../db/db.module.js';
import { otpCodes } from '../db/schema.js';
import { SmsGateway } from './sms.gateway.js';
import { isProd } from './auth.shared.js';

const OTP_TTL_MS = 5 * 60_000;

const MAX_ATTEMPTS = 5;

/** Code de vérification à 6 chiffres envoyé par SMS : émission, expiration et nombre d'essais. */
@Injectable()
export class OtpService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly sms: SmsGateway,
  ) {}

  /** Hors production le code est fixe (123456) pour faciliter les démonstrations. */
  async requestOtp(phone: string) {
    const code = isProd() ? String(randomInt(100000, 1000000)) : '123456';
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.db
      .insert(otpCodes)
      .values({ phone, code, expiresAt, attempts: 0 })
      .onConflictDoUpdate({
        target: otpCodes.phone,
        set: { code, expiresAt, attempts: 0 },
      });
    this.sms.send(phone, `Votre code de vérification : ${code}`);
    return { sent: true, resendInSeconds: 60 };
  }

  async consumeOtp(phone: string, code: string) {
    const [otp] = await this.db
      .select()
      .from(otpCodes)
      .where(eq(otpCodes.phone, phone));
    if (!otp || otp.expiresAt.getTime() < Date.now())
      throw new UnauthorizedException('Code expiré. Demandez-en un nouveau.');
    if (otp.attempts >= MAX_ATTEMPTS)
      throw new UnauthorizedException(
        'Trop d’essais. Demandez un nouveau code.',
      );
    if (otp.code !== code) {
      await this.db
        .update(otpCodes)
        .set({ attempts: otp.attempts + 1 })
        .where(eq(otpCodes.phone, phone));
      throw new UnauthorizedException('Code incorrect.');
    }
    await this.db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  }
}
