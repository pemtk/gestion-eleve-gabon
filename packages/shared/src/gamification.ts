/**
 * Points, série de jours et badges : règles pures, sans accès à la base, pour être testées avec des dates simulées.
 * Tout est calculé à partir des tâches terminées (date de validation, points, type) : rien n'est stocké en double.
 */

/** Points accordés pour une tâche terminée. */
export const POINTS_PER_TASK = 20;
/** Objectif quotidien affiché sur l'accueil de l'élève. */
export const DAILY_GOAL = 4;
/** Libreville : UTC+1 toute l'année (pas d'heure d'été). */
const SCHOOL_UTC_OFFSET_HOURS = 1;
const DAY_MS = 86_400_000;

/** Une tâche terminée par l'élève. */
export interface CompletionFact {
  title: string;
  /** Type de la tâche (« Cours », « Exercice », « Devoir »). */
  type: string;
  points: number;
  completedAt: Date;
}

export interface LearnerStats {
  points: number;
  tasksDone: number;
  /** Tâches de type « Cours » terminées (lecture). */
  lessonsDone: number;
  /** Tâches terminées aujourd'hui. */
  doneToday: number;
  /** Série en cours : jours consécutifs avec au moins une tâche, jusqu'à aujourd'hui (ou hier si rien n'est encore fait aujourd'hui). */
  streak: number;
  bestStreak: number;
}

/** Jour calendaire de l'école (« 2026-03-12 ») d'un instant donné. */
export function dayKey(at: Date): string {
  return new Date(at.getTime() + SCHOOL_UTC_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}

const dayNumber = (key: string) => Math.round(Date.parse(key) / DAY_MS);

/** Série en cours et meilleure série, à partir des jours distincts où une tâche a été terminée. */
export function streaksOf(
  days: Iterable<string>,
  today: string,
): { current: number; best: number } {
  const sorted = [...new Set(days)].map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous = Number.NaN;
  for (const day of sorted) {
    run = day === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  // La série reste vivante tant qu'on n'a pas laissé passer un jour entier : le dernier jour fait doit être aujourd'hui ou hier.
  const last = sorted[sorted.length - 1];
  const alive = last !== undefined && dayNumber(today) - last <= 1;
  return { current: alive ? run : 0, best };
}

/** Statistiques de l'élève à l'instant `now`. */
export function statsOf(completions: CompletionFact[], now: Date): LearnerStats {
  const today = dayKey(now);
  const { current, best } = streaksOf(
    completions.map((c) => dayKey(c.completedAt)),
    today,
  );
  return {
    points: completions.reduce((sum, c) => sum + c.points, 0),
    tasksDone: completions.length,
    lessonsDone: completions.filter((c) => c.type === 'Cours').length,
    doneToday: completions.filter((c) => dayKey(c.completedAt) === today).length,
    streak: current,
    bestStreak: best,
  };
}

export interface BadgeRule {
  id: string;
  icon: string;
  label: string;
  /** Ce qu'il faut faire pour l'obtenir. */
  description: string;
  /** Valeur actuelle de l'élève et cible à atteindre. */
  progress: (stats: LearnerStats) => { value: number; target: number };
}

const atLeast =
  (pick: (stats: LearnerStats) => number, target: number) => (stats: LearnerStats) => ({
    value: Math.min(pick(stats), target),
    target,
  });

export const BADGE_RULES: BadgeRule[] = [
  {
    id: 'first-step',
    icon: 'footprints',
    label: 'Premier pas',
    description: 'Terminer sa première tâche.',
    progress: atLeast((s) => s.tasksDone, 1),
  },
  {
    id: 'streak-5',
    icon: 'flame',
    label: 'Série de 5 jours',
    description: 'Terminer au moins une tâche 5 jours de suite.',
    progress: atLeast((s) => s.bestStreak, 5),
  },
  {
    id: 'reader',
    icon: 'book-open',
    label: 'Lecteur assidu',
    description: 'Terminer 5 tâches de cours.',
    progress: atLeast((s) => s.lessonsDone, 5),
  },
  {
    id: 'ten-tasks',
    icon: 'target',
    label: '10 tâches terminées',
    description: 'Terminer 10 tâches.',
    progress: atLeast((s) => s.tasksDone, 10),
  },
  {
    id: 'streak-10',
    icon: 'star',
    label: 'Série de 10 jours',
    description: 'Terminer au moins une tâche 10 jours de suite.',
    progress: atLeast((s) => s.bestStreak, 10),
  },
  {
    id: 'points-500',
    icon: 'award',
    label: '500 points',
    description: 'Cumuler 500 points.',
    progress: atLeast((s) => s.points, 500),
  },
  {
    id: 'points-2000',
    icon: 'trophy',
    label: '2 000 points',
    description: 'Cumuler 2 000 points.',
    progress: atLeast((s) => s.points, 2000),
  },
];

/** Identifiants des badges dont les conditions sont remplies. */
export function badgesReached(stats: LearnerStats): string[] {
  return BADGE_RULES.filter((rule) => {
    const { value, target } = rule.progress(stats);
    return value >= target;
  }).map((rule) => rule.id);
}

/** Libellé de date d'une ligne d'historique : « Aujourd’hui », « Hier », le jour dans la semaine, sinon la date. */
export function whenLabel(at: Date, now: Date): string {
  const days = dayNumber(dayKey(now)) - dayNumber(dayKey(at));
  if (days <= 0) return 'Aujourd’hui';
  if (days === 1) return 'Hier';
  const shifted = new Date(at.getTime() + SCHOOL_UTC_OFFSET_HOURS * 3_600_000);
  if (days < 7)
    return shifted
      .toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' })
      .replace(/^./, (c) => c.toUpperCase());
  return shifted.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}
