import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { ALERT_PREFS, PARENT_ALERTS } from '@sge/shared';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { alertPrefs } from '../../db/schema.js';

const prefsSchema = z.array(z.object({ id: z.string(), on: z.boolean() }));

/** Alertes du parent et réglage des types d'alerte reçus (§5.4). */
@Roles('parent')
@Controller('me/parent')
export class ParentAlertsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Préférences d'alerte du parent ; créées avec les valeurs par défaut à la première lecture. */
  private async prefs(userId: string) {
    await this.db
      .insert(alertPrefs)
      .values(ALERT_PREFS.map((a) => ({ ...a, userId })))
      .onConflictDoNothing();
    return this.db
      .select()
      .from(alertPrefs)
      .where(eq(alertPrefs.userId, userId))
      .orderBy(alertPrefs.id);
  }

  @Get('alerts')
  async alerts(@CurrentUser() user: AuthUser) {
    return {
      alerts: PARENT_ALERTS,
      prefs: (await this.prefs(user.sub)).map(({ userId: _u, ...p }) => p),
    };
  }

  @Put('alert-prefs')
  async setPrefs(
    @CurrentUser() user: AuthUser,
    @Body({ schema: prefsSchema }) body: z.infer<typeof prefsSchema>,
  ) {
    await this.prefs(user.sub);
    await this.db.transaction(async (tx) => {
      for (const p of body)
        await tx
          .update(alertPrefs)
          .set({ on: p.on })
          .where(and(eq(alertPrefs.userId, user.sub), eq(alertPrefs.id, p.id)));
    });
    return (await this.prefs(user.sub)).map(({ userId: _u, ...p }) => p);
  }
}
