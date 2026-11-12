import { describe, expect, it } from 'vitest';
import { StoreService } from '../common/store.service.js';
import { CasesService } from './cases.service.js';

const id = 'SC-0142';
const fresh = () => new CasesService(new StoreService());

describe('signalement confidentiel', () => {
  it('suit accusé → évaluation → plan d’action → clôture', () => {
    const cases = fresh();
    expect(cases.acknowledge(id).step).toBe(2);
    expect(cases.evaluate(id, { gravity: 'Modérée', measures: 'Entretien', informDirector: true, informFamily: false }).step).toBe(3);
    cases.addAction(id, 'Entretien avec l’élève', 'Référente');
    expect(cases.toClose(id).step).toBe(4);
    expect(cases.close(id, { summary: 'Situation apaisée', directorAgreement: true }).step).toBe(5);
    expect(cases.detail(id).state.log.length).toBeGreaterThanOrEqual(4);
  });

  it('interdit de sauter une étape et de clore sans action', () => {
    const cases = fresh();
    expect(() => cases.evaluate(id, { gravity: 'Faible', measures: '', informDirector: false, informFamily: false })).toThrow();
    cases.acknowledge(id);
    cases.evaluate(id, { gravity: 'Faible', measures: '', informDirector: false, informFamily: false });
    expect(() => cases.toClose(id)).toThrow(/au moins une action/);
    expect(() => cases.acknowledge(id)).toThrow();
  });
});
