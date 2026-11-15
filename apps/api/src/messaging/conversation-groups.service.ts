import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import {
  conversationMembers,
  conversations,
  studentParents,
  students,
} from '../db/schema.js';
import { taughtClassIds, type Conv } from './access.js';

/** Groupes de classe et d'école auxquels l'utilisateur appartient (créés à la demande) et liste de toutes ses conversations. */
@Injectable()
export class ConversationGroupsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /* ------------------------------ groupes (classes, école) ------------------------------ */

  /** Groupes auxquels l'utilisateur appartient, d'après sa classe, ses affectations ou ses enfants. */
  private async wantedGroups(user: AuthUser): Promise<
    {
      schoolId: string;
      kind: 'class' | 'school';
      audience?: 'students' | 'parents';
      classId?: string;
    }[]
  > {
    if (user.role === 'etablissement' && user.schoolId)
      return [{ schoolId: user.schoolId, kind: 'school' }];
    if (user.role === 'enseignant' && user.schoolId) {
      const ids = await taughtClassIds(this.db, user.sub, user.schoolId);
      return [
        { schoolId: user.schoolId, kind: 'school' },
        ...ids.flatMap((classId) =>
          (['students', 'parents'] as const).map((audience) => ({
            schoolId: user.schoolId!,
            kind: 'class' as const,
            audience,
            classId,
          })),
        ),
      ];
    }
    if (user.role === 'eleve' && user.schoolId) {
      const [s] = await this.db
        .select({ classId: students.classId })
        .from(students)
        .where(
          and(
            eq(students.userId, user.sub),
            eq(students.schoolId, user.schoolId),
          ),
        );
      return s
        ? [
            {
              schoolId: user.schoolId,
              kind: 'class',
              audience: 'students',
              classId: s.classId,
            },
          ]
        : [];
    }
    if (user.role === 'parent') {
      const kids = await this.db
        .select({ schoolId: students.schoolId, classId: students.classId })
        .from(studentParents)
        .innerJoin(students, eq(students.id, studentParents.studentId))
        .where(eq(studentParents.parentUserId, user.sub));
      const seen = new Set<string>();
      return kids
        .filter((k) => !seen.has(k.classId) && seen.add(k.classId))
        .map((k) => ({
          schoolId: k.schoolId,
          kind: 'class' as const,
          audience: 'parents' as const,
          classId: k.classId,
        }));
    }
    return [];
  }

  private groupKey = (g: {
    kind: string;
    schoolId: string;
    classId?: string;
    audience?: string;
  }) =>
    g.kind === 'school'
      ? `school:${g.schoolId}`
      : `class:${g.classId}:${g.audience}`;

  /** Crée au besoin les groupes de l'utilisateur (idempotent) et retourne leurs conversations. */
  private async groupsOf(user: AuthUser): Promise<Conv[]> {
    const wanted = await this.wantedGroups(user);
    if (!wanted.length) return [];
    await this.db
      .insert(conversations)
      .values(
        wanted.map((g) => ({
          id: randomUUID(),
          schoolId: g.schoolId,
          kind: g.kind,
          audience: g.audience ?? null,
          classId: g.classId ?? null,
          uniqueKey: this.groupKey(g),
        })),
      )
      .onConflictDoNothing();
    return this.db
      .select()
      .from(conversations)
      .where(
        inArray(
          conversations.uniqueKey,
          wanted.map((g) => this.groupKey(g)),
        ),
      );
  }

  /** Toutes les conversations de l'utilisateur, dans l'ordre de leur dernière activité. */
  async listConversations(user: AuthUser): Promise<Conv[]> {
    const [groups, mine, direction] = await Promise.all([
      this.groupsOf(user),
      this.db
        .select({ c: conversations })
        .from(conversationMembers)
        .innerJoin(
          conversations,
          eq(conversations.id, conversationMembers.conversationId),
        )
        .where(eq(conversationMembers.userId, user.sub)),
      // La direction voit aussi les messages adressés à l'administration et les fils de parents de ses classes.
      user.role === 'etablissement' && user.schoolId
        ? this.db
            .select()
            .from(conversations)
            .where(
              and(
                eq(conversations.schoolId, user.schoolId),
                sql`(${conversations.audience} = 'administration' or (${conversations.kind} = 'class' and ${conversations.audience} = 'parents'))`,
              ),
            )
        : Promise.resolve([] as Conv[]),
    ]);
    const all = new Map(
      [...groups, ...mine.map((m) => m.c), ...direction].map((c) => [c.id, c]),
    );
    return [...all.values()].sort(
      (a, b) =>
        (b.lastMessageAt ?? b.createdAt).getTime() -
        (a.lastMessageAt ?? a.createdAt).getTime(),
    );
  }
}
