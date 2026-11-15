import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { LIMITS, RateLimiter, type Limit } from '../common/rate-limiter.js';

/** Limitation des tentatives (connexion, code SMS, mot de passe) et du nombre de SMS envoyés ; blocages tracés au journal d'audit. */
@Injectable()
export class AuthThrottleService {
  constructor(
    private readonly limiter: RateLimiter,
    private readonly audit: AuditService,
  ) {}

  /** Compte un échec sous plusieurs clés ; la première fois qu'une clé se bloque, l'événement est tracé. */
  private async fail(kind: string, keys: [string, Limit][], ip?: string) {
    for (const [key, limit] of keys) {
      const { count } = await this.limiter.hit(key, limit);
      if (count === limit.max)
        await this.audit.record({
          action: 'auth.locked',
          resourceType: 'auth',
          resourceId: kind,
          outcome: 'refuse',
          ip,
          details: { key: key.split(':').slice(0, 2).join(':') },
        });
    }
  }

  /** Exécute une vérification à essais limités : refuse d'emblée si bloqué, compte l'échec, efface les compteurs au succès. */
  async guarded<T>(
    kind: string,
    keys: [string, Limit][],
    ip: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    await this.limiter.check(...keys.map(([k]) => k));
    try {
      const result = await fn();
      await this.limiter.reset(
        ...keys.filter(([k]) => !k.includes(':ip:')).map(([k]) => k),
      );
      return result;
    } catch (e) {
      if (e instanceof UnauthorizedException) await this.fail(kind, keys, ip);
      throw e;
    }
  }

  /** Quota d'envoi de SMS (par numéro et par adresse IP) : la demande qui dépasse est refusée avant tout envoi. */
  async smsQuota(phone: string, ip?: string) {
    const keys: [string, Limit][] = [
      [`sms:phone:${phone}`, LIMITS.smsPhone],
      ...(ip ? [[`sms:ip:${ip}`, LIMITS.smsIp] as [string, Limit]] : []),
    ];
    await this.limiter.check(...keys.map(([k]) => k));
    for (const [key, limit] of keys) await this.limiter.hit(key, limit);
  }
}
