import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { type Contact, type ThreadSummary } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import {
  assignments,
  classes,
  conversationMembers,
  conversations,
  organizations,
  studentParents,
  students,
  teachers,
  users,
} from '../db/schema.js';
import { taughtClassIds } from './access.js';
import { ConversationThreadsService } from './conversation-threads.service.js';

interface ContactRow extends Contact {
  schoolId: string;
  userId?: string;
}

/** Qui l'utilisateur peut écrire, et ouverture (idempotente) d'une conversation privée. */
@Injectable()
export class ConversationContactsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly threads: ConversationThreadsService,
  ) {}

  /* ------------------------------ contacts et création de conversations privées ------------------------------ */

  /** Les personnes que l'utilisateur peut écrire, d'après sa place dans l'école (jamais une liste libre d'utilisateurs). */
  async contacts(user: AuthUser, q = ''): Promise<ContactRow[]> {
    const out = new Map<string, ContactRow>();
    const add = (c: ContactRow) => {
      if (!out.has(c.key)) out.set(c.key, c);
    };
    const teachersOf = async (
      classIds: string[],
      schoolId: string,
      className: (id: string) => string,
    ) => {
      if (!classIds.length) return;
      const rows = await this.db
        .select({
          userId: teachers.userId,
          name: users.name,
          initials: users.initials,
          classId: assignments.classId,
          subject: assignments.subject,
          principal: assignments.principal,
        })
        .from(assignments)
        .innerJoin(teachers, eq(teachers.id, assignments.teacherId))
        .innerJoin(users, eq(users.id, teachers.userId))
        .where(
          and(
            inArray(assignments.classId, classIds),
            eq(assignments.schoolId, schoolId),
          ),
        );
      for (const r of rows)
        add({
          key: `u:${r.userId}`,
          name: r.name,
          initials: r.initials,
          label: `Enseignant · ${className(r.classId)} · ${r.subject}${r.principal ? ' (principal)' : ''}`,
          schoolId,
          userId: r.userId!,
        });
    };
    if (user.role === 'parent') {
      const kids = await this.db
        .select({
          schoolId: students.schoolId,
          classId: students.classId,
          className: classes.name,
        })
        .from(studentParents)
        .innerJoin(students, eq(students.id, studentParents.studentId))
        .innerJoin(classes, eq(classes.id, students.classId))
        .where(eq(studentParents.parentUserId, user.sub));
      for (const schoolId of new Set(kids.map((k) => k.schoolId))) {
        const [school] = await this.db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, schoolId));
        add({
          key: `admin:${schoolId}`,
          name: 'Administration',
          initials: '',
          label: `École · ${school?.name ?? ''}`,
          schoolId,
        });
        await teachersOf(
          [
            ...new Set(
              kids.filter((k) => k.schoolId === schoolId).map((k) => k.classId),
            ),
          ],
          schoolId,
          (id) => kids.find((k) => k.classId === id)?.className ?? '',
        );
      }
    } else if (user.role === 'eleve' && user.schoolId) {
      const [me] = await this.db
        .select({ classId: students.classId, className: classes.name })
        .from(students)
        .innerJoin(classes, eq(classes.id, students.classId))
        .where(
          and(
            eq(students.userId, user.sub),
            eq(students.schoolId, user.schoolId),
          ),
        );
      if (me) await teachersOf([me.classId], user.schoolId, () => me.className);
    } else if (
      (user.role === 'enseignant' || user.role === 'etablissement') &&
      user.schoolId
    ) {
      const schoolId = user.schoolId;
      const mine =
        user.role === 'enseignant'
          ? await taughtClassIds(this.db, user.sub, schoolId)
          : null;
      const scope = mine
        ? mine.length
          ? inArray(students.classId, mine)
          : sql`false`
        : undefined;
      const kids = await this.db
        .select({
          id: students.id,
          first: students.firstName,
          userId: students.userId,
          name: students.firstName,
          last: students.lastName,
          className: classes.name,
        })
        .from(students)
        .innerJoin(classes, eq(classes.id, students.classId))
        .where(and(eq(students.schoolId, schoolId), scope));
      const parents = await this.db
        .select({
          studentId: studentParents.studentId,
          userId: studentParents.parentUserId,
          name: users.name,
          initials: users.initials,
        })
        .from(studentParents)
        .innerJoin(users, eq(users.id, studentParents.parentUserId))
        .where(
          inArray(studentParents.studentId, kids.map((k) => k.id).concat('-')),
        );
      for (const p of parents)
        add({
          key: `u:${p.userId}`,
          name: p.name,
          initials: p.initials,
          label: `Parent de ${kids.find((k) => k.id === p.studentId)?.first ?? ''}`,
          schoolId,
          userId: p.userId!,
        });
      const pupils = kids.filter((k) => k.userId);
      if (user.role === 'enseignant' && pupils.length) {
        const accounts = await this.db
          .select({ id: users.id, name: users.name, initials: users.initials })
          .from(users)
          .where(
            inArray(
              users.id,
              pupils.map((k) => k.userId!),
            ),
          );
        for (const a of accounts)
          add({
            key: `u:${a.id}`,
            name: a.name,
            initials: a.initials,
            label: `Élève · ${pupils.find((k) => k.userId === a.id)?.className ?? ''}`,
            schoolId,
            userId: a.id,
          });
      }
      const staff = await this.db
        .select({
          id: users.id,
          name: users.name,
          initials: users.initials,
          role: users.role,
        })
        .from(users)
        .where(
          and(
            eq(users.schoolId, schoolId),
            inArray(
              users.role,
              user.role === 'enseignant' ? ['etablissement'] : ['enseignant'],
            ),
            ne(users.id, user.sub),
            eq(users.activated, true),
          ),
        );
      for (const s of staff)
        add({
          key: `u:${s.id}`,
          name: s.name,
          initials: s.initials,
          label: s.role === 'etablissement' ? 'Direction' : 'Enseignant',
          schoolId,
          userId: s.id,
        });
    }
    const needle = q.trim().toLowerCase();
    return [...out.values()]
      .filter((c) => !needle || c.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .slice(0, 200);
  }

  /** Ouvre (ou retrouve) la conversation privée avec un contact autorisé : une seule par couple, jamais de doublon. */
  async startPrivate(user: AuthUser, key: string): Promise<ThreadSummary> {
    const contact = (await this.contacts(user)).find((c) => c.key === key);
    if (!contact) throw new NotFoundException('Contact introuvable.');
    const toAdministration = key.startsWith('admin:');
    const uniqueKey = toAdministration
      ? `admin:${contact.schoolId}:${user.sub}`
      : `pm:${[user.sub, contact.userId!].sort().join('|')}`;
    const conv = await this.db.transaction(async (tx) => {
      await tx
        .insert(conversations)
        .values({
          id: randomUUID(),
          schoolId: contact.schoolId,
          kind: 'private',
          audience: toAdministration ? 'administration' : null,
          uniqueKey,
          createdBy: user.sub,
        })
        .onConflictDoNothing();
      const [c] = await tx
        .select()
        .from(conversations)
        .where(eq(conversations.uniqueKey, uniqueKey));
      await tx
        .insert(conversationMembers)
        .values([
          { conversationId: c!.id, userId: user.sub },
          ...(toAdministration
            ? []
            : [{ conversationId: c!.id, userId: contact.userId! }]),
        ])
        .onConflictDoNothing();
      return c!;
    });
    return (await this.threads.threads(user)).find((t) => t.id === conv.id)!;
  }
}
