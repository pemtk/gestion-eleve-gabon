import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { accessOf } from './access.js';
import { ConversationGroupsService } from './conversation-groups.service.js';

/** Messages non lus : par conversation (curseur de lecture) et au total (pastille de l'onglet). */
@Injectable()
export class ConversationUnreadService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly groups: ConversationGroupsService,
  ) {}

  /** Messages des autres après le curseur de lecture de l'utilisateur, par conversation. */
  async unreadCounts(
    userId: string,
    ids: string[],
  ): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const rows = await this.db.execute<{
      conversation_id: string;
      n: number;
    }>(sql`
      SELECT m.conversation_id, count(*)::int AS n FROM conversation_messages m
      LEFT JOIN conversation_reads r ON r.conversation_id = m.conversation_id AND r.user_id = ${userId}
      WHERE m.conversation_id IN (${sql.join(
        ids.map((i) => sql`${i}`),
        sql`, `,
      )}) AND m.id > COALESCE(r.last_read_message_id, 0) AND m.sender_id IS DISTINCT FROM ${userId}
      GROUP BY m.conversation_id`);
    return new Map(rows.rows.map((r) => [r.conversation_id, Number(r.n)]));
  }

  async unreadTotal(user: AuthUser): Promise<number> {
    const list = await this.groups.listConversations(user);
    const readable: string[] = [];
    for (const c of list)
      if ((await accessOf(this.db, user, c)).read) readable.push(c.id);
    return [...(await this.unreadCounts(user.sub, readable)).values()].reduce(
      (a, b) => a + b,
      0,
    );
  }
}
