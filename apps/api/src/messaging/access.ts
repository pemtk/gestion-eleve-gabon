import { and, eq } from 'drizzle-orm';
import type { AuthUser } from '../common/auth.js';
import type { Db } from '../db/db.module.js';
import { assignments, conversationMembers, conversations, studentParents, students, teachers } from '../db/schema.js';

export type Conv = typeof conversations.$inferSelect;
export interface Access { read: boolean; post: boolean }
const NONE: Access = { read: false, post: false };
const FULL: Access = { read: true, post: true };

/** Classes que l'enseignant a dans ses affectations (vide s'il n'a pas de fiche enseignant). */
export async function taughtClassIds(db: Db, userId: string, schoolId: string): Promise<string[]> {
  const rows = await db.select({ classId: assignments.classId }).from(assignments).innerJoin(teachers, eq(teachers.id, assignments.teacherId))
    .where(and(eq(teachers.userId, userId), eq(teachers.schoolId, schoolId), eq(assignments.schoolId, schoolId)));
  return [...new Set(rows.map((r) => r.classId))];
}

/**
 * Droits d'un utilisateur sur une conversation, déduits de son appartenance — jamais de l'URL ni du corps de la requête.
 * - privée : ses participants ; si elle s'adresse à l'administration, toute la direction de l'école ;
 * - classe « élèves » : les enseignants de la classe et ses élèves (tous écrivent) ;
 * - classe « parents » : les enseignants de la classe écrivent, ses parents lisent seulement, la direction lit et écrit ;
 * - école : les enseignants et la direction de l'école (salle des professeurs).
 */
export async function accessOf(db: Db, user: AuthUser, c: Conv): Promise<Access> {
  if (c.kind === 'private') {
    const [member] = await db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, c.id), eq(conversationMembers.userId, user.sub)));
    if (member) return FULL;
    return c.audience === 'administration' && user.role === 'etablissement' && user.schoolId === c.schoolId ? FULL : NONE;
  }
  if (c.kind === 'school') return (user.role === 'enseignant' || user.role === 'etablissement') && user.schoolId === c.schoolId ? FULL : NONE;
  if (c.kind !== 'class' || !c.classId) return NONE;
  if (user.role === 'enseignant') return user.schoolId === c.schoolId && (await taughtClassIds(db, user.sub, c.schoolId)).includes(c.classId) ? FULL : NONE;
  if (c.audience === 'students') {
    if (user.role !== 'eleve' || user.schoolId !== c.schoolId) return NONE;
    const [s] = await db.select({ id: students.id }).from(students).where(and(eq(students.userId, user.sub), eq(students.schoolId, c.schoolId), eq(students.classId, c.classId)));
    return s ? FULL : NONE;
  }
  if (c.audience === 'parents') {
    if (user.role === 'etablissement') return user.schoolId === c.schoolId ? FULL : NONE;
    if (user.role !== 'parent') return NONE;
    const [child] = await db.select({ id: students.id }).from(studentParents).innerJoin(students, eq(students.id, studentParents.studentId))
      .where(and(eq(studentParents.parentUserId, user.sub), eq(students.schoolId, c.schoolId), eq(students.classId, c.classId))).limit(1);
    return child ? { read: true, post: false } : NONE;
  }
  return NONE;
}

export async function conversationById(db: Db, id: string): Promise<Conv | undefined> {
  const [c] = await db.select().from(conversations).where(eq(conversations.id, id));
  return c;
}
