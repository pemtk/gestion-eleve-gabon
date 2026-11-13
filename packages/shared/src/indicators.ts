import { PRIVACY_THRESHOLD } from './validation.js';

/** Seuils d'alerte des tableaux de bord (en %). */
export const LOW_COMPLETION = 45;
export const LOW_ACTIVATION = 50;
export const LOW_GRADE_ENTRY = 60;

/** Pourcentage arrondi ; `null` quand il n'y a rien à mesurer (dénominateur nul). */
export function pct(part: number, total: number): number | null {
  return total > 0 ? Math.round((100 * part) / total) : null;
}

export const pctLabel = (value: number | null): string => (value === null ? '—' : `${value} %`);

/** Nombre avec espace pour les milliers (« 4 812 »). */
export const spaced = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * Taux destiné à un partenaire : masqué (`null`) si l'effectif sur lequel il repose est sous le seuil de confidentialité.
 * Le seuil porte sur le dénominateur (les individus concernés), pas sur le résultat.
 */
export function maskedPct(part: number, total: number): number | null {
  return total < PRIVACY_THRESHOLD ? null : pct(part, total);
}

export type SchoolStatus = 'Actif' | 'Faible activation' | 'En retard de saisie' | 'Engagement faible';

/** Statut d'un établissement vu par l'agent : le premier problème rencontré, dans l'ordre activation → saisie des notes → engagement. */
export function schoolStatus(s: { activation: number | null; gradeEntry: number | null; completion?: number | null }): SchoolStatus {
  if (s.activation !== null && s.activation < LOW_ACTIVATION) return 'Faible activation';
  if (s.gradeEntry !== null && s.gradeEntry < LOW_GRADE_ENTRY) return 'En retard de saisie';
  if (s.completion != null && s.completion < LOW_COMPLETION) return 'Engagement faible';
  return 'Actif';
}

/** Compare deux dates ISO (AAAA-MM-JJ) : nombre de jours écoulés depuis `iso` à la date `today`. */
export function daysSince(iso: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000);
}
