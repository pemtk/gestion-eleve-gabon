import type { BarRow } from '@sge/shared';

/** Une barre de graphique ; sans mesure (`null`), « — » plutôt que 0 %. */
export const bar = (label: string, value: number | null): BarRow => ({
  label,
  pct: value ?? 0,
  display: value === null ? '—' : undefined,
});

/** Barres triées de la plus haute à la plus basse (les sans-mesure en dernier). */
export const byPct = (rows: [string, number | null][]) =>
  rows
    .sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1))
    .map(([label, v]) => bar(label, v));

/** Date du jour au format ISO (AAAA-MM-JJ). */
export const today = () => new Date().toISOString().slice(0, 10);
