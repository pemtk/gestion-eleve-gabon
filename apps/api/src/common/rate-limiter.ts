import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { rateLimits } from '../db/schema.js';

export interface Limit {
  /** Nombre d'événements (échecs ou demandes) tolérés dans la fenêtre : le suivant est refusé. */
  max: number;
  windowMs: number;
  /** Durée du blocage une fois la limite atteinte. */
  blockMs: number;
}

export class TooManyRequestsException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super({
      statusCode: HttpStatus.TOO_MANY_REQUESTS, code: 'RATE_LIMITED', retryAfterSeconds,
      message: `Trop de tentatives. Réessayez dans ${retryAfterSeconds >= 120 ? `${Math.ceil(retryAfterSeconds / 60)} minutes` : `${retryAfterSeconds} secondes`}.`,
    }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** Limites par défaut. Les échecs de connexion sont comptés par numéro (cible d'une attaque) et par adresse IP (balayage de numéros). */
export const LIMITS = {
  loginPhone: { max: 5, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
  loginIp: { max: 30, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
  otpVerifyPhone: { max: 10, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
  otpVerifyIp: { max: 40, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
  /** Envois de SMS (code, invitation) : protège le budget SMS contre le « SMS pumping ». */
  smsPhone: { max: 5, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  smsIp: { max: 30, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  passwordChange: { max: 5, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
} satisfies Record<string, Limit>;

/**
 * Limitation de débit stockée en base (valable avec plusieurs instances de l'API, survit aux redémarrages).
 * `check` refuse si la clé est bloquée ; `hit` compte un événement et bloque la clé dès que `max` est atteint ;
 * `reset` efface le compteur (connexion réussie). Un blocage échu repart d'un compteur neuf.
 */
@Injectable()
export class RateLimiter {
  constructor(@Inject(DB) private readonly db: Db) {}

  async check(...keys: string[]): Promise<void> {
    let wait = 0;
    for (const key of keys) {
      const [row] = await this.db.select({ blockedUntil: rateLimits.blockedUntil }).from(rateLimits).where(eq(rateLimits.key, key));
      if (row?.blockedUntil && row.blockedUntil.getTime() > Date.now()) wait = Math.max(wait, Math.ceil((row.blockedUntil.getTime() - Date.now()) / 1000));
    }
    if (wait) throw new TooManyRequestsException(wait);
  }

  async hit(key: string, limit: Limit): Promise<{ count: number; blocked: boolean }> {
    const windowSeconds = limit.windowMs / 1000;
    const blockSeconds = limit.blockMs / 1000;
    const result = await this.db.execute<{ count: number; blocked: boolean }>(sql`
      INSERT INTO rate_limits AS r (key, count, window_start, blocked_until)
      VALUES (${key}, 1, now(), CASE WHEN 1 >= ${limit.max} THEN now() + make_interval(secs => ${blockSeconds}) END)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN r.window_start < now() - make_interval(secs => ${windowSeconds}) OR (r.blocked_until IS NOT NULL AND r.blocked_until <= now()) THEN 1 ELSE r.count + 1 END,
        window_start = CASE WHEN r.window_start < now() - make_interval(secs => ${windowSeconds}) OR (r.blocked_until IS NOT NULL AND r.blocked_until <= now()) THEN now() ELSE r.window_start END,
        blocked_until = CASE
          WHEN r.window_start < now() - make_interval(secs => ${windowSeconds}) OR (r.blocked_until IS NOT NULL AND r.blocked_until <= now()) THEN CASE WHEN 1 >= ${limit.max} THEN now() + make_interval(secs => ${blockSeconds}) END
          WHEN r.count + 1 >= ${limit.max} THEN now() + make_interval(secs => ${blockSeconds})
          ELSE r.blocked_until END
      RETURNING count, (blocked_until IS NOT NULL AND blocked_until > now()) AS blocked`);
    return result.rows[0]!;
  }

  async reset(...keys: string[]): Promise<void> {
    for (const key of keys) await this.db.delete(rateLimits).where(eq(rateLimits.key, key));
  }
}
