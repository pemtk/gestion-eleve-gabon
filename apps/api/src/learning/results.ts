import { and, asc, eq } from 'drizzle-orm';
import { formatGrade } from '@sge/shared';
import type { Db } from '../db/db.module.js';
import { evaluations, grades, schoolSubjects } from '../db/schema.js';

export interface SubjectResult { subject: string; average: number; coefficient: number; notes: { label: string; value: number; meta: string; comment: string; date: string }[] }

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const dateLabel = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/**
 * Résultats publiés d'un élève pour un trimestre, matière par matière : la moyenne d'une matière pondère chaque note
 * par le coefficient de son évaluation ; la moyenne générale pondère chaque matière par son coefficient (propre à l'école).
 */
export async function subjectResults(db: Db, schoolId: string, studentId: string, trimester: string): Promise<SubjectResult[]> {
  const rows = await db.select({ e: evaluations, g: grades }).from(grades).innerJoin(evaluations, eq(evaluations.id, grades.evaluationId))
    .where(and(eq(grades.studentId, studentId), eq(evaluations.schoolId, schoolId), eq(evaluations.trimester, trimester))).orderBy(asc(evaluations.heldOn), asc(evaluations.createdAt));
  const coefs = new Map((await db.select().from(schoolSubjects).where(eq(schoolSubjects.schoolId, schoolId))).map((s) => [s.name, s.coefficient]));
  const bySubject = new Map<string, typeof rows>();
  for (const r of rows) bySubject.set(r.e.subject, [...(bySubject.get(r.e.subject) ?? []), r]);
  const out = [...bySubject.entries()].map(([subject, list]) => {
    const weight = list.reduce((n, r) => n + r.e.coefficient, 0);
    const average = list.reduce((n, r) => n + r.g.value * r.e.coefficient, 0) / (weight || 1);
    return {
      subject, coefficient: coefs.get(subject) ?? 1, average: Math.round(average * 10) / 10,
      notes: list.map((r) => ({ label: r.e.label, value: r.g.value, meta: `${dateLabel(r.e.heldOn)} · coef. ${r.e.coefficient}`, comment: r.g.comment, date: r.e.heldOn })),
    };
  });
  // Matières les plus lourdes d'abord (coefficient), puis par ordre alphabétique.
  return out.sort((a, b) => b.coefficient - a.coefficient || a.subject.localeCompare(b.subject, 'fr'));
}

/** « Dernières notes » : la dernière note de chaque matière, les plus récentes d'abord. */
export function recentGrades(subjects: SubjectResult[], limit = 2) {
  return subjects.map((s) => ({ subject: s.subject, ...s.notes.at(-1)! })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
    .map((n) => ({ subject: n.subject, value: n.value, comment: n.comment }));
}

export function overallAverage(subjects: SubjectResult[]): number | null {
  const weight = subjects.reduce((n, s) => n + s.coefficient, 0);
  return weight ? Math.round((subjects.reduce((n, s) => n + s.average * s.coefficient, 0) / weight) * 10) / 10 : null;
}

export { formatGrade };
