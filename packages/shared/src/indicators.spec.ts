import { describe, expect, it } from 'vitest';
import { daysSince, maskedPct, pct, pctLabel, schoolStatus, spaced } from './index.js';

describe('indicateurs', () => {
  it('calcule des pourcentages arrondis, et rien sans effectif', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
    expect(pct(0, 0)).toBeNull();
    expect(pctLabel(pct(0, 0))).toBe('—');
    expect(pctLabel(74)).toBe('74 %');
  });
  it('formate les milliers', () => expect([spaced(812), spaced(4812), spaced(46210)]).toEqual(['812', '4 812', '46 210']));
  it('masque un taux dont l’effectif est sous le seuil de 10', () => {
    expect(maskedPct(5, 9)).toBeNull();
    expect(maskedPct(5, 10)).toBe(50);
    expect(maskedPct(0, 0)).toBeNull();
  });
  it('classe les établissements', () => {
    expect(schoolStatus({ activation: 40, gradeEntry: 90 })).toBe('Faible activation');
    expect(schoolStatus({ activation: 80, gradeEntry: 30 })).toBe('En retard de saisie');
    expect(schoolStatus({ activation: 80, gradeEntry: 90 })).toBe('Actif');
    expect(schoolStatus({ activation: 80, gradeEntry: 90, completion: 30 })).toBe('Engagement faible');
    expect(schoolStatus({ activation: null, gradeEntry: null })).toBe('Actif');
  });
  it('compte les jours écoulés', () => expect(daysSince('2026-11-09', '2026-11-13')).toBe(4));
});
