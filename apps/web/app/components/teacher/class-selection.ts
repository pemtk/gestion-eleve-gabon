import type { TeacherClass } from './types';

/** Clé d'une affectation dans l'adresse (`?classe=`) : une classe peut être enseignée pour plusieurs matières. */
export const classKey = (c: TeacherClass) => `${c.id}|${c.subject}`;

/** Affectation demandée par l'adresse, sinon la première (la classe principale en priorité). */
export function selectedClass(classes: TeacherClass[], key: string | null): TeacherClass | null {
  return (
    classes.find((c) => classKey(c) === key) ??
    classes.find((c) => c.id === key) ??
    classes.find((c) => c.principal) ??
    classes[0] ??
    null
  );
}
