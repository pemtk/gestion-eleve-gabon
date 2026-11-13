import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, like } from 'drizzle-orm';
import type { AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { auditLog, users } from '../db/schema.js';

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome?: 'ok' | 'refuse';
  user?: Pick<AuthUser, 'sub' | 'schoolId'> | null;
  userId?: string | null;
  schoolId?: string | null;
  ip?: string | null;
  details?: Record<string, unknown>;
}

/** Journal d'audit en ajout seul : qui a lu ou fait quoi, quand, depuis quelle adresse. */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async record(e: AuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({
      action: e.action, resourceType: e.resourceType, resourceId: e.resourceId ?? null, outcome: e.outcome ?? 'ok',
      userId: e.userId ?? e.user?.sub ?? null, schoolId: e.schoolId ?? e.user?.schoolId ?? null, ip: e.ip ?? null, details: e.details ?? null,
    });
  }

  /** Exécute `fn` et trace le résultat : « ok » si elle aboutit, « refuse » si elle échoue (introuvable, droits, étape invalide). */
  async traced<T>(e: Omit<AuditEntry, 'outcome'>, fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      await this.record({ ...e, outcome: 'ok' });
      return result;
    } catch (err) {
      await this.record({ ...e, outcome: 'refuse' });
      throw err;
    }
  }

  list(filter: { schoolId?: string; resourceType?: string; actionPrefix?: string; limit?: number }) {
    const where = and(
      filter.schoolId ? eq(auditLog.schoolId, filter.schoolId) : undefined,
      filter.resourceType ? eq(auditLog.resourceType, filter.resourceType) : undefined,
      filter.actionPrefix ? like(auditLog.action, `${filter.actionPrefix}%`) : undefined,
    );
    return this.db.select({ id: auditLog.id, at: auditLog.at, action: auditLog.action, resourceType: auditLog.resourceType, resourceId: auditLog.resourceId, outcome: auditLog.outcome, ip: auditLog.ip, schoolId: auditLog.schoolId, userId: auditLog.userId, userName: users.name })
      .from(auditLog).leftJoin(users, eq(users.id, auditLog.userId)).where(where).orderBy(desc(auditLog.id)).limit(Math.min(filter.limit ?? 100, 500));
  }
}
