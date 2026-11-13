import { describe, expect, it } from 'vitest';
import type { ClassStats, SchoolStats } from '../indicators/indicators.service.js';
import { aggregateProvinces, filterSchools } from './partner.service.js';

const cls = (students: number, o: Partial<ClassStats> = {}): ClassStats => ({
  id: `c${students}`, name: 'Classe', students, activated: students, withParent: 0, tasks: 2, expected: students * 2, done: students, gradesExpected: 0, gradesEntered: 0,
  records: students * 5, present: students * 4, absent: students, lastAttendance: null, ...o,
});
const school = (id: string, province: string, level: string, classes: ClassStats[]): SchoolStats => ({
  id, name: id, province, level, classes, teachers: { total: 0, active: 0 }, casesToAcknowledge: 0, pendingLinks: 0, unjustifiedAbsences: 0,
});

describe('indicateurs du partenaire', () => {
  it('publie les taux d’une province de 10 élèves ou plus, calculés sur les données', () => {
    const [row] = aggregateProvinces([school('a', 'Estuaire', 'Lycée', [cls(10, { activated: 8 })])], new Map());
    expect(row?.cells.slice(0, 3)).toEqual(['80 %', '50 %', '80 %']);
  });

  it('masque toute cellule reposant sur moins de 10 élèves, sans rien laisser deviner', () => {
    const [row] = aggregateProvinces([school('a', 'Nyanga', 'Collège', [cls(9)])], new Map([['a', 4]]));
    expect(row?.cells).toEqual([null, null, null, null]);
  });

  it('additionne les écoles d’une même province avant de masquer', () => {
    const rows = aggregateProvinces([school('a', 'Nyanga', 'Collège', [cls(6)]), school('b', 'Nyanga', 'Primaire', [cls(5)])], new Map([['a', 6], ['b', 5]]));
    expect(rows[0]).toMatchObject({ province: 'Nyanga', schools: 2 });
    expect(rows[0]?.cells[0]).toBe('100 %'); // 11 élèves : publié
    expect(rows[0]?.cells[3]).toBe('11'); // 11 signalements : publié
  });

  it('masque le nombre de signalements sous le seuil même quand les taux sont publiés', () => {
    const [row] = aggregateProvinces([school('a', 'Estuaire', 'Lycée', [cls(40)])], new Map([['a', 9]]));
    expect(row?.cells[0]).toBe('100 %');
    expect(row?.cells[3]).toBeNull();
  });

  it('indique « — » quand rien n’a été mesuré (pas de tâche, pas d’appel) plutôt que 0 %', () => {
    const [row] = aggregateProvinces([school('a', 'Estuaire', 'Lycée', [cls(12, { tasks: 0, expected: 0, done: 0, records: 0, present: 0, absent: 0 })])], new Map());
    expect(row?.cells.slice(1, 3)).toEqual(['—', '—']);
  });

  it('filtre par région et par niveau, et ignore les écoles sans province', () => {
    const stats = [school('a', 'Estuaire', 'Lycée', []), school('b', 'Nyanga', 'Collège', []), { ...school('c', 'Estuaire', 'Lycée', []), province: null }];
    expect(filterSchools(stats, 'Intérieur', 'Tous').map((s) => s.id)).toEqual(['b']);
    expect(filterSchools(stats, 'Estuaire', 'Lycée').map((s) => s.id)).toEqual(['a']);
    expect(filterSchools(stats, 'Nyanga', 'Lycée')).toEqual([]);
    expect(filterSchools(stats, 'Toutes', 'Tous').map((s) => s.id)).toEqual(['a', 'b']);
  });
});
