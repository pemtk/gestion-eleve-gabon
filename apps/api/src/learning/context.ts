import { NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import type { AuthUser } from '../common/auth.js';
import { schoolOf } from '../common/auth.js';
import type { Db } from '../db/db.module.js';
import { assignments, classes, students, taskCompletions, tasks, teachers } from '../db/schema.js';

/** Fiche élève liée au compte connecté (classe, école) ; absente tant que le compte n'est pas relié à une fiche. */
export async function studentOf(db: Db, user: AuthUser) {
  const [s] = await db.select().from(students).where(and(eq(students.userId, user.sub), eq(students.schoolId, schoolOf(user))));
  return s;
}

export interface TeacherClass { classId: string; className: string; subject: string; principal: boolean; students: number }

/** Classes (et matières) de l'enseignant connecté, d'après ses affectations. Vide si le compte n'a pas de fiche enseignant. */
export async function teacherClasses(db: Db, user: AuthUser): Promise<{ teacherId: string | null; classes: TeacherClass[] }> {
  const sid = schoolOf(user);
  const [teacher] = await db.select().from(teachers).where(and(eq(teachers.userId, user.sub), eq(teachers.schoolId, sid)));
  if (!teacher) return { teacherId: null, classes: [] };
  const rows = await db.select({ a: assignments, className: classes.name }).from(assignments).innerJoin(classes, eq(classes.id, assignments.classId)).where(and(eq(assignments.teacherId, teacher.id), eq(assignments.schoolId, sid))).orderBy(asc(classes.name));
  const counts = rows.length ? await db.select({ classId: students.classId, n: count() }).from(students).where(and(eq(students.schoolId, sid), inArray(students.classId, rows.map((r) => r.a.classId)))).groupBy(students.classId) : [];
  return {
    teacherId: teacher.id,
    classes: rows.map((r) => ({ classId: r.a.classId, className: r.className, subject: r.a.subject, principal: r.a.principal, students: counts.find((c) => c.classId === r.a.classId)?.n ?? 0 })),
  };
}

/** La classe doit figurer dans les affectations de l'enseignant ; sinon elle est « introuvable » (on ne révèle rien d'autre). */
export async function assertTeaches(db: Db, user: AuthUser, classId: string, subject?: string) {
  const mine = await teacherClasses(db, user);
  const hit = mine.classes.find((c) => c.classId === classId && (!subject || c.subject === subject));
  if (!mine.teacherId || !hit) throw new NotFoundException('Classe introuvable dans vos affectations.');
  return { teacherId: mine.teacherId, ...hit };
}

/** Statut d'une tâche pour un élève : sans avancement ou invalidée (« redo »), elle reste à faire. */
export function taskStatusOf(completion?: { status: string }): 'todo' | 'doing' | 'done' {
  if (completion?.status === 'done') return 'done';
  if (completion?.status === 'doing') return 'doing';
  return 'todo';
}

export async function completionsOf(db: Db, studentId: string) {
  return db.select().from(taskCompletions).where(eq(taskCompletions.studentId, studentId));
}

export function tasksOfClass(db: Db, schoolId: string, classId: string) {
  return db.select().from(tasks).where(and(eq(tasks.schoolId, schoolId), eq(tasks.classId, classId))).orderBy(asc(tasks.position));
}
