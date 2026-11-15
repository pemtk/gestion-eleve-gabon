import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, ne, sql } from 'drizzle-orm';
import { ROLE_LABELS, type Contact, type Message, type ThreadSummary } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../common/auth.js';
import { RateLimiter, type Limit } from '../common/rate-limiter.js';
import { DB, type Db } from '../db/db.module.js';
import { assignments, classes, conversationMembers, conversationMessages, conversationReads, conversations, organizations, studentParents, students, teachers, users } from '../db/schema.js';
import { FilesService } from '../files/files.service.js';
import { accessOf, taughtClassIds, type Access, type Conv } from './access.js';

/** 60 messages par minute et par utilisateur : une file hors ligne qui se vide passe, un robot non. */
const SEND_LIMIT: Limit = { max: 60, windowMs: 60_000, blockMs: 60_000 };
const TZ = 'Africa/Libreville';
const PAGE = 200;

interface ContactRow extends Contact { schoolId: string; userId?: string }

/** Libellé d'heure d'une conversation : l'heure aujourd'hui, « Hier », le jour dans la semaine, sinon la date. */
export function timeLabel(at: Date, now = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString('fr-CA', { timeZone: TZ });
  if (day(at) === day(now)) return at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  const days = Math.round((Date.parse(day(now)) - Date.parse(day(at))) / 86_400_000);
  if (days === 1) return 'Hier';
  if (days < 7) return at.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: TZ }).replace(/^./, (c) => c.toUpperCase());
  return at.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: TZ });
}

@Injectable()
export class ConversationsService {
  constructor(@Inject(DB) private readonly db: Db, private readonly limiter: RateLimiter, private readonly files: FilesService) {}

  /* ------------------------------ groupes (classes, école) ------------------------------ */

  /** Groupes auxquels l'utilisateur appartient, d'après sa classe, ses affectations ou ses enfants. */
  private async wantedGroups(user: AuthUser): Promise<{ schoolId: string; kind: 'class' | 'school'; audience?: 'students' | 'parents'; classId?: string }[]> {
    if (user.role === 'etablissement' && user.schoolId) return [{ schoolId: user.schoolId, kind: 'school' }];
    if (user.role === 'enseignant' && user.schoolId) {
      const ids = await taughtClassIds(this.db, user.sub, user.schoolId);
      return [{ schoolId: user.schoolId, kind: 'school' }, ...ids.flatMap((classId) => (['students', 'parents'] as const).map((audience) => ({ schoolId: user.schoolId!, kind: 'class' as const, audience, classId })))];
    }
    if (user.role === 'eleve' && user.schoolId) {
      const [s] = await this.db.select({ classId: students.classId }).from(students).where(and(eq(students.userId, user.sub), eq(students.schoolId, user.schoolId)));
      return s ? [{ schoolId: user.schoolId, kind: 'class', audience: 'students', classId: s.classId }] : [];
    }
    if (user.role === 'parent') {
      const kids = await this.db.select({ schoolId: students.schoolId, classId: students.classId }).from(studentParents).innerJoin(students, eq(students.id, studentParents.studentId)).where(eq(studentParents.parentUserId, user.sub));
      const seen = new Set<string>();
      return kids.filter((k) => !seen.has(k.classId) && seen.add(k.classId)).map((k) => ({ schoolId: k.schoolId, kind: 'class' as const, audience: 'parents' as const, classId: k.classId }));
    }
    return [];
  }

  private groupKey = (g: { kind: string; schoolId: string; classId?: string; audience?: string }) => (g.kind === 'school' ? `school:${g.schoolId}` : `class:${g.classId}:${g.audience}`);

  /** Crée au besoin les groupes de l'utilisateur (idempotent) et retourne leurs conversations. */
  private async groupsOf(user: AuthUser): Promise<Conv[]> {
    const wanted = await this.wantedGroups(user);
    if (!wanted.length) return [];
    await this.db.insert(conversations).values(wanted.map((g) => ({ id: randomUUID(), schoolId: g.schoolId, kind: g.kind, audience: g.audience ?? null, classId: g.classId ?? null, uniqueKey: this.groupKey(g) }))).onConflictDoNothing();
    return this.db.select().from(conversations).where(inArray(conversations.uniqueKey, wanted.map((g) => this.groupKey(g))));
  }

  /** Toutes les conversations de l'utilisateur, dans l'ordre de leur dernière activité. */
  async listConversations(user: AuthUser): Promise<Conv[]> {
    const [groups, mine, direction] = await Promise.all([
      this.groupsOf(user),
      this.db.select({ c: conversations }).from(conversationMembers).innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId)).where(eq(conversationMembers.userId, user.sub)),
      // La direction voit aussi les messages adressés à l'administration et les fils de parents de ses classes.
      user.role === 'etablissement' && user.schoolId
        ? this.db.select().from(conversations).where(and(eq(conversations.schoolId, user.schoolId), sql`(${conversations.audience} = 'administration' or (${conversations.kind} = 'class' and ${conversations.audience} = 'parents'))`))
        : Promise.resolve([] as Conv[]),
    ]);
    const all = new Map([...groups, ...mine.map((m) => m.c), ...direction].map((c) => [c.id, c]));
    return [...all.values()].sort((a, b) => (b.lastMessageAt ?? b.createdAt).getTime() - (a.lastMessageAt ?? a.createdAt).getTime());
  }

  /* ------------------------------ liste des fils ------------------------------ */

  async threads(user: AuthUser): Promise<ThreadSummary[]> {
    const list = await this.listConversations(user);
    if (!list.length) return [];
    const ids = list.map((c) => c.id);
    const [last, unread, members, classRows, schools] = await Promise.all([
      this.db.execute<{ conversation_id: string; text: string | null; file_id: string | null; created_at: Date; sender: string | null }>(sql`
        SELECT DISTINCT ON (m.conversation_id) m.conversation_id, m.text, m.file_id, m.created_at, u.name AS sender
        FROM conversation_messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.conversation_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) ORDER BY m.conversation_id, m.id DESC`),
      this.unreadCounts(user.sub, ids),
      this.db.select({ cid: conversationMembers.conversationId, user: users }).from(conversationMembers).innerJoin(users, eq(users.id, conversationMembers.userId)).where(and(inArray(conversationMembers.conversationId, ids), ne(conversationMembers.userId, user.sub))),
      this.db.select({ id: classes.id, name: classes.name }).from(classes).where(inArray(classes.id, list.map((c) => c.classId).filter((x): x is string => !!x))),
      this.db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, [...new Set(list.map((c) => c.schoolId))])),
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
      const preview = l ? `${c.kind !== 'private' && l.sender ? `${l.sender.split(' ')[0]} : ` : ''}${l.text ?? 'Photo'}` : 'Aucun message';
      out.push({ id: c.id, ...base, last: preview, time: l ? timeLabel(new Date(l.created_at)) : '', unread: unread.get(c.id) ?? 0, group: c.kind !== 'private', canPost: access.post });
    }
    return out;
  }

  /** Nom, sous-titre et pastille d'une conversation vue par `user`. */
  private title(user: AuthUser, c: Conv, ctx: { className: string; school: string; other?: typeof users.$inferSelect }): Pick<ThreadSummary, 'name' | 'kind' | 'initials' | 'icon'> {
    if (c.kind === 'school') return { name: 'Équipe pédagogique', kind: `École · ${ctx.school}`, initials: '', icon: 'school' };
    if (c.kind === 'class') {
      return c.audience === 'students'
        ? { name: `Classe ${ctx.className}`, kind: user.role === 'eleve' ? 'Classe · élèves et enseignants' : 'Classe · élèves', initials: '', icon: 'users' }
        : { name: `Parents de ${ctx.className}`, kind: user.role === 'parent' ? 'Classe · annonces des enseignants' : 'Classe · parents', initials: '', icon: 'users' };
    }
    if (c.audience === 'administration') {
      return user.role === 'parent'
        ? { name: 'Administration', kind: `École · ${ctx.school}`, initials: '', icon: 'school' }
        : { name: ctx.other?.name ?? 'Parent', kind: 'Parent · administration', initials: ctx.other?.initials ?? '' };
    }
    return { name: ctx.other?.name ?? 'Conversation', kind: `Privé · ${ROLE_LABELS[(ctx.other?.role ?? 'parent') as keyof typeof ROLE_LABELS] ?? ''}`, initials: ctx.other?.initials ?? '' };
  }

  /** Messages des autres après le curseur de lecture de l'utilisateur, par conversation. */
  private async unreadCounts(userId: string, ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const rows = await this.db.execute<{ conversation_id: string; n: number }>(sql`
      SELECT m.conversation_id, count(*)::int AS n FROM conversation_messages m
      LEFT JOIN conversation_reads r ON r.conversation_id = m.conversation_id AND r.user_id = ${userId}
      WHERE m.conversation_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) AND m.id > COALESCE(r.last_read_message_id, 0) AND m.sender_id IS DISTINCT FROM ${userId}
      GROUP BY m.conversation_id`);
    return new Map(rows.rows.map((r) => [r.conversation_id, Number(r.n)]));
  }

  async unreadTotal(user: AuthUser): Promise<number> {
    const list = await this.listConversations(user);
    const readable: string[] = [];
    for (const c of list) if ((await accessOf(this.db, user, c)).read) readable.push(c.id);
    return [...(await this.unreadCounts(user.sub, readable)).values()].reduce((a, b) => a + b, 0);
  }

  /* ------------------------------ accès à une conversation ------------------------------ */

  /** Conversation lisible par l'utilisateur, sinon « introuvable » (on ne révèle pas qu'elle existe). */
  async open(user: AuthUser, id: string, need: 'read' | 'post' = 'read'): Promise<{ conv: Conv; access: Access }> {
    const [conv] = await this.db.select().from(conversations).where(eq(conversations.id, id));
    const access = conv ? await accessOf(this.db, user, conv) : { read: false, post: false };
    if (!conv || !access.read) throw new NotFoundException('Conversation introuvable.');
    if (need === 'post' && !access.post) throw new ForbiddenException('Vous ne pouvez pas écrire dans cette conversation.');
    return { conv, access };
  }

  /** Résumé d'un fil (nom, droit d'écrire…) tel que l'utilisateur le voit. */
  async summary(user: AuthUser, id: string): Promise<ThreadSummary> {
    await this.open(user, id);
    const found = (await this.threads(user)).find((t) => t.id === id);
    if (!found) throw new NotFoundException('Conversation introuvable.');
    return found;
  }

  /* ------------------------------ messages ------------------------------ */

  async messages(user: AuthUser, id: string, after = 0): Promise<{ messages: Message[]; canPost: boolean }> {
    const { access } = await this.open(user, id);
    const rows = await this.db.select({ m: conversationMessages, sender: users.name }).from(conversationMessages).leftJoin(users, eq(users.id, conversationMessages.senderId))
      .where(and(eq(conversationMessages.conversationId, id), gt(conversationMessages.id, after))).orderBy(after ? asc(conversationMessages.id) : desc(conversationMessages.id)).limit(PAGE);
    const ordered = after ? rows : rows.reverse();
    return { canPost: access.post, messages: ordered.map(({ m, sender }) => this.view(m, user, sender)) };
  }

  private view(m: typeof conversationMessages.$inferSelect, user: AuthUser, sender: string | null): Message {
    return { id: m.clientId, seq: m.id, mine: m.senderId === user.sub, text: m.text, image: m.fileId ? true : undefined, fileId: m.fileId ?? undefined, sender: sender ?? undefined, time: timeLabel(m.createdAt) };
  }

  /** `clientId` rend l'envoi idempotent : un message gardé hors ligne puis renvoyé n'est jamais dupliqué. */
  async send(user: AuthUser, id: string, body: { text?: string; fileId?: string; clientId: string }): Promise<Message> {
    const { conv } = await this.open(user, id, 'post');
    await this.limiter.check(`msg:${user.sub}`);
    await this.limiter.hit(`msg:${user.sub}`, SEND_LIMIT);
    const message = await this.db.transaction(async (tx) => {
      const [inserted] = await tx.insert(conversationMessages).values({ conversationId: id, clientId: body.clientId, senderId: user.sub, senderRole: user.role, text: body.text ?? null, fileId: body.fileId ?? null }).onConflictDoNothing().returning();
      if (inserted) {
        if (body.fileId) await this.files.attach(tx, user, body.fileId, 'message', 'conversation', conv.id, conv.schoolId);
        await tx.update(conversations).set({ lastMessageAt: inserted.createdAt }).where(eq(conversations.id, id));
        // Ce qu'on écrit soi-même est lu.
        await tx.insert(conversationReads).values({ conversationId: id, userId: user.sub, lastReadMessageId: inserted.id })
          .onConflictDoUpdate({ target: [conversationReads.conversationId, conversationReads.userId], set: { lastReadMessageId: sql`greatest(${conversationReads.lastReadMessageId}, ${inserted.id})` } });
        return inserted;
      }
      const [existing] = await tx.select().from(conversationMessages).where(and(eq(conversationMessages.conversationId, id), eq(conversationMessages.clientId, body.clientId)));
      if (existing!.senderId !== user.sub) throw new BadRequestException('Identifiant de message déjà utilisé.');
      return existing!;
    });
    return this.view(message, user, user.name);
  }

  /** Marque la conversation comme lue (jusqu'au dernier message, ou `upTo`). */
  async markRead(user: AuthUser, id: string, upTo?: number): Promise<{ unread: number }> {
    await this.open(user, id);
    const [{ last }] = await this.db.select({ last: sql<number>`coalesce(max(${conversationMessages.id}), 0)::int` }).from(conversationMessages).where(and(eq(conversationMessages.conversationId, id), upTo ? sql`${conversationMessages.id} <= ${upTo}` : undefined)) as [{ last: number }];
    await this.db.insert(conversationReads).values({ conversationId: id, userId: user.sub, lastReadMessageId: last })
      .onConflictDoUpdate({ target: [conversationReads.conversationId, conversationReads.userId], set: { lastReadMessageId: sql`greatest(${conversationReads.lastReadMessageId}, ${last})` } });
    return { unread: (await this.unreadCounts(user.sub, [id])).get(id) ?? 0 };
  }

  /* ------------------------------ contacts et création de conversations privées ------------------------------ */

  /** Les personnes que l'utilisateur peut écrire, d'après sa place dans l'école (jamais une liste libre d'utilisateurs). */
  async contacts(user: AuthUser, q = ''): Promise<ContactRow[]> {
    const out = new Map<string, ContactRow>();
    const add = (c: ContactRow) => { if (!out.has(c.key)) out.set(c.key, c); };
    const teachersOf = async (classIds: string[], schoolId: string, className: (id: string) => string) => {
      if (!classIds.length) return;
      const rows = await this.db.select({ userId: teachers.userId, name: users.name, initials: users.initials, classId: assignments.classId, subject: assignments.subject, principal: assignments.principal })
        .from(assignments).innerJoin(teachers, eq(teachers.id, assignments.teacherId)).innerJoin(users, eq(users.id, teachers.userId))
        .where(and(inArray(assignments.classId, classIds), eq(assignments.schoolId, schoolId)));
      for (const r of rows) add({ key: `u:${r.userId}`, name: r.name, initials: r.initials, label: `Enseignant · ${className(r.classId)} · ${r.subject}${r.principal ? ' (principal)' : ''}`, schoolId, userId: r.userId! });
    };
    if (user.role === 'parent') {
      const kids = await this.db.select({ schoolId: students.schoolId, classId: students.classId, className: classes.name }).from(studentParents).innerJoin(students, eq(students.id, studentParents.studentId)).innerJoin(classes, eq(classes.id, students.classId)).where(eq(studentParents.parentUserId, user.sub));
      for (const schoolId of new Set(kids.map((k) => k.schoolId))) {
        const [school] = await this.db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, schoolId));
        add({ key: `admin:${schoolId}`, name: 'Administration', initials: '', label: `École · ${school?.name ?? ''}`, schoolId });
        await teachersOf([...new Set(kids.filter((k) => k.schoolId === schoolId).map((k) => k.classId))], schoolId, (id) => kids.find((k) => k.classId === id)?.className ?? '');
      }
    } else if (user.role === 'eleve' && user.schoolId) {
      const [me] = await this.db.select({ classId: students.classId, className: classes.name }).from(students).innerJoin(classes, eq(classes.id, students.classId)).where(and(eq(students.userId, user.sub), eq(students.schoolId, user.schoolId)));
      if (me) await teachersOf([me.classId], user.schoolId, () => me.className);
    } else if ((user.role === 'enseignant' || user.role === 'etablissement') && user.schoolId) {
      const schoolId = user.schoolId;
      const mine = user.role === 'enseignant' ? await taughtClassIds(this.db, user.sub, schoolId) : null;
      const scope = mine ? (mine.length ? inArray(students.classId, mine) : sql`false`) : undefined;
      const kids = await this.db.select({ id: students.id, first: students.firstName, userId: students.userId, name: students.firstName, last: students.lastName, className: classes.name }).from(students).innerJoin(classes, eq(classes.id, students.classId)).where(and(eq(students.schoolId, schoolId), scope));
      const parents = await this.db.select({ studentId: studentParents.studentId, userId: studentParents.parentUserId, name: users.name, initials: users.initials }).from(studentParents).innerJoin(users, eq(users.id, studentParents.parentUserId)).where(inArray(studentParents.studentId, kids.map((k) => k.id).concat('-')));
      for (const p of parents) add({ key: `u:${p.userId}`, name: p.name, initials: p.initials, label: `Parent de ${kids.find((k) => k.id === p.studentId)?.first ?? ''}`, schoolId, userId: p.userId! });
      const pupils = kids.filter((k) => k.userId);
      if (user.role === 'enseignant' && pupils.length) {
        const accounts = await this.db.select({ id: users.id, name: users.name, initials: users.initials }).from(users).where(inArray(users.id, pupils.map((k) => k.userId!)));
        for (const a of accounts) add({ key: `u:${a.id}`, name: a.name, initials: a.initials, label: `Élève · ${pupils.find((k) => k.userId === a.id)?.className ?? ''}`, schoolId, userId: a.id });
      }
      const staff = await this.db.select({ id: users.id, name: users.name, initials: users.initials, role: users.role }).from(users).where(and(eq(users.schoolId, schoolId), inArray(users.role, user.role === 'enseignant' ? ['etablissement'] : ['enseignant']), ne(users.id, user.sub), eq(users.activated, true)));
      for (const s of staff) add({ key: `u:${s.id}`, name: s.name, initials: s.initials, label: s.role === 'etablissement' ? 'Direction' : 'Enseignant', schoolId, userId: s.id });
    }
    const needle = q.trim().toLowerCase();
    return [...out.values()].filter((c) => !needle || c.name.toLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name, 'fr')).slice(0, 200);
  }

  /** Ouvre (ou retrouve) la conversation privée avec un contact autorisé : une seule par couple, jamais de doublon. */
  async startPrivate(user: AuthUser, key: string): Promise<ThreadSummary> {
    const contact = (await this.contacts(user)).find((c) => c.key === key);
    if (!contact) throw new NotFoundException('Contact introuvable.');
    const toAdministration = key.startsWith('admin:');
    const uniqueKey = toAdministration ? `admin:${contact.schoolId}:${user.sub}` : `pm:${[user.sub, contact.userId!].sort().join('|')}`;
    const conv = await this.db.transaction(async (tx) => {
      await tx.insert(conversations).values({ id: randomUUID(), schoolId: contact.schoolId, kind: 'private', audience: toAdministration ? 'administration' : null, uniqueKey, createdBy: user.sub }).onConflictDoNothing();
      const [c] = await tx.select().from(conversations).where(eq(conversations.uniqueKey, uniqueKey));
      await tx.insert(conversationMembers).values([{ conversationId: c!.id, userId: user.sub }, ...(toAdministration ? [] : [{ conversationId: c!.id, userId: contact.userId! }])]).onConflictDoNothing();
      return c!;
    });
    return (await this.threads(user)).find((t) => t.id === conv.id)!;
  }
}
