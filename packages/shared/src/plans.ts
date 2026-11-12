import { PLAN_FEATURES, PLAN_ORDER, PLAN_PRICES } from './seed.js';
import type { Plan } from './validation.js';

/** Fonctionnalités débloquées par formule (la formule supérieure inclut l'inférieure). */
export function planLevel(plan: Plan): number {
  return PLAN_ORDER.indexOf(plan);
}
export function planHas(plan: Plan) {
  const lvl = planLevel(plan);
  return { sms: lvl >= 1, stats: lvl >= 1, network: lvl >= 2, diocese: lvl >= 3 };
}
export type PlanFeatureKey = keyof ReturnType<typeof planHas>;
export function planPrice(plan: Plan, period: 'mensuelle' | 'annuelle' = 'annuelle'): number {
  return period === 'annuelle' ? PLAN_PRICES[plan] * 10 : PLAN_PRICES[plan];
}
export function planFeatureList(plan: Plan) {
  const lvl = planLevel(plan);
  return {
    included: PLAN_FEATURES.filter(([, min]) => min <= lvl).map(([label]) => label),
    missing: PLAN_FEATURES.filter(([, min]) => min > lvl).map(([label, min]) => ({ label, needs: PLAN_ORDER[min] as Plan })),
  };
}
