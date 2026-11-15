import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { ROLE_LABELS, type ThreadSummary } from '@sge/shared';
import type { AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import {
  classes,
  conversationMembers,
  organizations,
  users,
} from '../db/schema.js';
import { accessOf, type Conv } from './access.js';
import { ConversationGroupsService } from './conversation-groups.service.js';
import { ConversationUnreadService } from './conversation-unread.service.js';
import { ConversationAccessService } from './conversation-access.service.js';
import { timeLabel } from './time-label.js';

/** Liste des fils telle que l'utilisateur la voit : nom, sous-titre, dernier message, non-lus et droit d'écrire. */
@Injectable()
export class ConversationThreadsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly groups: ConversationGroupsService,
    private readonly unread: ConversationUnreadService,
    private readonly access: ConversationAccessService,
  ) {}

  /* ------------------------------ liste des fils ------------------------------ */

  async threads(user: AuthUser): Promise<ThreadSummary[]> {
    const list = await this.groups.listConversations(user);
    if (!list.length) return [];
    const ids = list.map((c) => c.id);
    const [last, unread, members, classRows, schools] = await Promise.all([
      this.db.execute<{
        conversation_id: string;
        text: string | null;
        file_id: string | null;
        created_at: Date;
        sender: string | null;
      }>(sql`
        SELECT DISTINCT ON (m.conversation_id) m.conversation_id, m.text, m.file_id, m.created_at, u.name AS sender
        FROM conversation_messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.conversation_id IN (${sql.join(
          ids.map((i) => sql`${i}`),
          sql`, `,
        )}) ORDER BY m.conversation_id, m.id DESC`),
      this.unread.unreadCounts(user.sub, ids),
      this.db
        .select({ cid: conversationMembers.conversationId, user: users })
        .from(conversationMembers)
        .innerJoin(users, eq(users.id, conversationMembers.userId))
        .where(
          and(
            inArray(conversationMembers.conversationId, ids),
            ne(conversationMembers.userId, user.sub),
          ),
        ),
      this.db
        .select({ id: classes.id, name: classes.name })
        .from(classes)
        .where(
          inArray(
            classes.id,
            list.map((c) => c.classId).filter((x): x is string => !!x),
          ),
        ),
      this.db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(
          inArray(organizations.id, [...new Set(list.map((c) => c.schoolId))]),
        ),
    ]);
    const lastBy = new Map(last.rows.map((r) => [r.conversation_id, r]));
    const out: ThreadSummary[] = [];
    for (const c of list) {
      const access = await accessOf(this.db, user, c);
      if (!access.read) continue;
      const l = lastBy.get(c.id);
      const className = classRows.find((k) => k.id === c.classId)?.name ?? '';
      const school = schools.find((s) => s.id === c.schoolId)?.name ?? '';
      const other = members.find((m) => m.cid === c.id)?.user;
      const base = this.title(user, c, { className, school, other });
      const preview = l
        ? `${c.kind !== 'private' && l.sender ? `${l.sender.split(' ')[0]} : ` : ''}${l.text ?? 'Photo'}`
        : 'Aucun message';
      out.push({
        id: c.id,
        ...base,
        last: preview,
        time: l ? timeLabel(new Date(l.created_at)) : '',
        unread: unread.get(c.id) ?? 0,
        group: c.kind !== 'private',
        canPost: access.post,
      });
    }
    return out;
  }

  /** Nom, sous-titre et pastille d'une conversation vue par `user`. */
  private title(
    user: AuthUser,
    c: Conv,
    ctx: {
      className: string;
      school: string;
      other?: typeof users.$inferSelect;
    },
  ): Pick<ThreadSummary, 'name' | 'kind' | 'initials' | 'icon'> {
    if (c.kind === 'school')
      return {
        name: 'Équipe pédagogique',
        kind: `École · ${ctx.school}`,
        initials: '',
        icon: 'school',
      };
    if (c.kind === 'class') {
      return c.audience === 'students'
        ? {
            name: `Classe ${ctx.className}`,
            kind:
              user.role === 'eleve'
                ? 'Classe · élèves et enseignants'
                : 'Classe · élèves',
            initials: '',
            icon: 'users',
          }
        : {
            name: `Parents de ${ctx.className}`,
            kind:
              user.role === 'parent'
                ? 'Classe · annonces des enseignants'
                : 'Classe · parents',
            initials: '',
            icon: 'users',
          };
    }
    if (c.audience === 'administration') {
      return user.role === 'parent'
        ? {
            name: 'Administration',
            kind: `École · ${ctx.school}`,
            initials: '',
            icon: 'school',
          }
        : {
            name: ctx.other?.name ?? 'Parent',
            kind: 'Parent · administration',
            initials: ctx.other?.initials ?? '',
          };
    }
    return {
      name: ctx.other?.name ?? 'Conversation',
      kind: `Privé · ${ROLE_LABELS[(ctx.other?.role ?? 'parent') as keyof typeof ROLE_LABELS] ?? ''}`,
      initials: ctx.other?.initials ?? '',
    };
  }

  /** Résumé d'un fil (nom, droit d'écrire…) tel que l'utilisateur le voit. */
  async summary(user: AuthUser, id: string): Promise<ThreadSummary> {
    await this.access.open(user, id);
    const found = (await this.threads(user)).find((t) => t.id === id);
    if (!found) throw new NotFoundException('Conversation introuvable.');
    return found;
  }
}
