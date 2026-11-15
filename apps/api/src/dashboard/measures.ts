import { pct } from '@sge/shared';
import { totals, type SchoolStats } from '../indicators/indicators.service.js';

/** Période des indicateurs de suivi (complétion, appels, absences), en jours. */
export const WEEK = 7;

/** Mesures d'un établissement sous forme d'indicateurs prêts à afficher. */
export function measures(s: SchoolStats) {
  const t = totals(s.classes);
  return {
    t,
    activation: pct(t.activated, t.students),
    parents: pct(t.withParent, t.students),
    completion: pct(t.done, t.expected),
    gradeEntry: pct(t.gradesEntered, t.gradesExpected),
    presence: pct(t.present, t.records),
    accounts: t.activated + s.teachers.active,
  };
}
