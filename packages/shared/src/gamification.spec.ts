import { describe, expect, it } from 'vitest';
import {
  BADGE_RULES,
  badgesReached,
  dayKey,
  statsOf,
  streaksOf,
  whenLabel,
  type CompletionFact,
} from './gamification.js';

/** Instant à midi (heure de Libreville) du jour donné. */
const noon = (day: string) => new Date(`${day}T11:00:00Z`);
const done = (day: string, type = 'Exercice', points = 20): CompletionFact => ({
  title: `Tâche du ${day}`,
  type,
  points,
  completedAt: noon(day),
});

describe('dayKey', () => {
  it('compte le jour à l’heure de Libreville (UTC+1)', () => {
    expect(dayKey(new Date('2026-03-12T23:30:00Z'))).toBe('2026-03-13');
    expect(dayKey(new Date('2026-03-12T22:30:00Z'))).toBe('2026-03-12');
  });
});

describe('streaksOf', () => {
  const today = '2026-03-12';
  it('augmente chaque jour consécutif', () => {
    expect(streaksOf(['2026-03-10'], '2026-03-10').current).toBe(1);
    expect(streaksOf(['2026-03-10', '2026-03-11'], '2026-03-11').current).toBe(2);
    expect(streaksOf(['2026-03-10', '2026-03-11', '2026-03-12'], today).current).toBe(3);
  });
  it('reste vivante si rien n’est encore fait aujourd’hui mais que c’était fait hier', () => {
    expect(streaksOf(['2026-03-10', '2026-03-11'], today).current).toBe(2);
  });
  it('se rompt quand un jour entier est manqué, en gardant la meilleure série', () => {
    const result = streaksOf(['2026-03-08', '2026-03-09', '2026-03-10'], today);
    expect(result).toEqual({ current: 0, best: 3 });
  });
  it('repart de 1 après une pause', () => {
    const result = streaksOf(['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-12'], today);
    expect(result).toEqual({ current: 1, best: 3 });
  });
  it('ne compte qu’une fois plusieurs tâches le même jour', () => {
    expect(streaksOf(['2026-03-12', '2026-03-12', '2026-03-12'], today).current).toBe(1);
  });
  it('vaut zéro sans aucune tâche', () => {
    expect(streaksOf([], today)).toEqual({ current: 0, best: 0 });
  });
});

describe('statsOf', () => {
  it('remet « tâches du jour » à zéro le lendemain', () => {
    const facts = [done('2026-03-11'), done('2026-03-11')];
    expect(statsOf(facts, noon('2026-03-11')).doneToday).toBe(2);
    expect(statsOf(facts, noon('2026-03-12')).doneToday).toBe(0);
  });
  it('additionne les points et compte les cours', () => {
    const facts = [done('2026-03-10', 'Cours'), done('2026-03-11', 'Devoir', 25)];
    expect(statsOf(facts, noon('2026-03-11'))).toMatchObject({
      points: 45,
      tasksDone: 2,
      lessonsDone: 1,
    });
  });
});

describe('badges', () => {
  const days = (n: number) =>
    Array.from({ length: n }, (_, i) => done(`2026-03-${String(i + 1).padStart(2, '0')}`));

  it('aucun badge sans activité', () => {
    expect(badgesReached(statsOf([], noon('2026-03-12')))).toEqual([]);
  });
  it('« Premier pas » dès la première tâche', () => {
    expect(badgesReached(statsOf([done('2026-03-12')], noon('2026-03-12')))).toEqual([
      'first-step',
    ]);
  });
  it('série de 5 jours, puis de 10 jours, avec la tâche du jour', () => {
    expect(badgesReached(statsOf(days(4), noon('2026-03-04')))).not.toContain('streak-5');
    expect(badgesReached(statsOf(days(5), noon('2026-03-05')))).toContain('streak-5');
    const ten = badgesReached(statsOf(days(10), noon('2026-03-10')));
    expect(ten).toEqual(expect.arrayContaining(['streak-5', 'streak-10', 'ten-tasks']));
  });
  it('la série brisée ne retire pas le badge déjà mérité (meilleure série)', () => {
    expect(badgesReached(statsOf(days(5), noon('2026-03-20')))).toContain('streak-5');
  });
  it('lecteur assidu après 5 tâches de cours', () => {
    const lessons = Array.from({ length: 5 }, (_, i) => done(`2026-03-0${i + 1}`, 'Cours'));
    expect(badgesReached(statsOf(lessons, noon('2026-03-05')))).toContain('reader');
  });
  it('les badges de points suivent le total', () => {
    const big = [done('2026-03-01', 'Devoir', 500)];
    expect(badgesReached(statsOf(big, noon('2026-03-01')))).toContain('points-500');
    expect(badgesReached(statsOf(big, noon('2026-03-01')))).not.toContain('points-2000');
  });
  it('chaque règle a un identifiant unique', () => {
    expect(new Set(BADGE_RULES.map((r) => r.id)).size).toBe(BADGE_RULES.length);
  });
});

describe('whenLabel', () => {
  const now = noon('2026-03-12'); // jeudi
  it('Aujourd’hui, Hier, jour de la semaine, puis date', () => {
    expect(whenLabel(noon('2026-03-12'), now)).toBe('Aujourd’hui');
    expect(whenLabel(noon('2026-03-11'), now)).toBe('Hier');
    expect(whenLabel(noon('2026-03-09'), now)).toBe('Lundi');
    expect(whenLabel(noon('2026-02-20'), now)).toBe('20/02');
  });
});
