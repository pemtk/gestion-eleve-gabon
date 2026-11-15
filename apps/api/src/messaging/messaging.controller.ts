import { Controller, Get, Inject, Post } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NOTIFICATIONS } from '@sge/shared';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { notificationReads } from '../db/schema.js';

type MobileRole = 'eleve' | 'parent' | 'enseignant';

/** Notifications de l'application mobile (les conversations sont dans `ConversationsController`). */
@Roles('eleve', 'parent', 'enseignant')
@Controller()
export class MessagingController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('notifications')
  async notifications(@CurrentUser() user: AuthUser) {
    const read = new Set(
      (
        await this.db
          .select()
          .from(notificationReads)
          .where(eq(notificationReads.userId, user.sub))
      ).map((r) => r.notificationId),
    );
    return NOTIFICATIONS[user.role as MobileRole].map((n) => ({
      ...n,
      read: read.has(n.id),
    }));
  }

  @Post('notifications/read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    const rows = NOTIFICATIONS[user.role as MobileRole].map((n) => ({
      userId: user.sub,
      notificationId: n.id,
    }));
    await this.db.insert(notificationReads).values(rows).onConflictDoNothing();
    return { ok: true };
  }
}
