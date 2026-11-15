import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { type SessionUser } from '@sge/shared';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { ACCESS_TTL_SECONDS, RefreshTokens } from './refresh-tokens.service.js';
import { toSessionUser } from './auth.shared.js';

/** Sessions : jeton d'accès de 15 minutes, renouvellement par jeton à usage unique, déconnexion d'un ou de tous les appareils. */
@Injectable()
export class AuthSessionService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly refresh: RefreshTokens,
    private readonly audit: AuditService,
  ) {}

  async session(user: SessionUser) {
    const payload: AuthUser = {
      sub: user.id,
      role: user.role,
      name: user.name,
      phone: user.phone,
      schoolId: user.schoolId ?? null,
    };
    const { token } = await this.refresh.issue(user.id);
    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken: token,
      expiresIn: ACCESS_TTL_SECONDS,
      user,
    };
  }

  /** Renouvelle la session : nouveau jeton d'accès + nouveau jeton de renouvellement (l'ancien est invalidé). */
  async renew(refreshToken: string, ip?: string) {
    let rotated: { userId: string; token: string };
    try {
      rotated = await this.refresh.rotate(refreshToken);
    } catch (e) {
      await this.audit.record({
        action: 'auth.refresh.refused',
        resourceType: 'auth',
        outcome: 'refuse',
        ip,
      });
      throw e;
    }
    const [record] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, rotated.userId));
    if (!record || !record.activated) {
      await this.refresh.revoke(rotated.token);
      throw new UnauthorizedException('Session expirée, reconnectez-vous.');
    }
    const user = toSessionUser(record);
    const payload: AuthUser = {
      sub: user.id,
      role: user.role,
      name: user.name,
      phone: user.phone,
      schoolId: user.schoolId ?? null,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken: rotated.token,
      expiresIn: ACCESS_TTL_SECONDS,
      user,
    };
  }

  async logout(refreshToken: string) {
    await this.refresh.revoke(refreshToken);
    return { ok: true };
  }

  async logoutAll(user: Pick<AuthUser, 'sub' | 'schoolId'>, ip?: string) {
    await this.refresh.revokeAll(user.sub);
    await this.audit.record({
      action: 'auth.logout_all',
      resourceType: 'user',
      resourceId: user.sub,
      user,
      ip,
    });
    return { ok: true };
  }
}
