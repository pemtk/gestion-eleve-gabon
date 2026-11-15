import {
  LOW_COMPLETION,
  LOW_GRADE_ENTRY,
  pct,
  type SideItem,
} from '@sge/shared';
import type { SchoolStats } from '../indicators/indicators.service.js';
import { WEEK, measures } from './measures.js';

/** Pour qui les points d'attention sont calculés : la direction voit tout, l'agent et le réseau seulement le suivi pédagogique. */
export type AlertAudience = 'school' | 'agent' | 'network';

/** Destination de chaque type d'alerte, selon l'espace où elle s'affiche. */
const ALERT_LINKS: Record<
  AlertAudience,
  Record<'classes' | 'grades' | 'cases' | 'requests' | 'accounts', string>
> = {
  school: {
    classes: '/ecole/configuration?tab=classes',
    grades: '/ecole/resultats',
    cases: '/ecole/vie-scolaire',
    requests: '/ecole/utilisateurs?tab=ratt',
    accounts: '/ecole/utilisateurs',
  },
  agent: {
    classes: '/agent/ecole',
    grades: '/agent/ecole',
    cases: '/agent/ecole',
    requests: '/agent/ecole',
    accounts: '/agent/ecole',
  },
  network: {
    classes: '/ecole/reseau',
    grades: '/ecole/reseau',
    cases: '/ecole/reseau',
    requests: '/ecole/reseau',
    accounts: '/ecole/reseau',
  },
};

/**
 * Points d'attention d'un établissement : engagement faible, notes en retard, comptes peu activés ;
 * pour la direction seulement, aussi les signalements confidentiels à accuser et les rattachements à valider
 * (un agent ou un réseau n'a pas à connaître le nombre de signalements d'une école).
 */
export function alertsOf(
  s: SchoolStats,
  audience: AlertAudience = 'school',
  prefix = '',
): SideItem[] {
  const links = ALERT_LINKS[audience];
  const out: SideItem[] = [];
  const at = (x: string) => `${prefix}${x}`;
  for (const c of s.classes) {
    const completion = pct(c.done, c.expected);
    if (completion !== null && completion < LOW_COMPLETION)
      out.push({
        icon: 'circle-alert',
        title: at(`${c.name} — engagement faible`),
        text: `${completion} % de complétion sur ${WEEK} jours (${c.done} tâches terminées sur ${c.expected}).`,
        cta: 'Voir la classe',
        to: links.classes,
        highlight: true,
      });
  }
  for (const c of s.classes) {
    const entry = pct(c.gradesEntered, c.gradesExpected);
    if (entry !== null && entry < LOW_GRADE_ENTRY)
      out.push({
        icon: 'clock',
        title: at(`Notes en retard · ${c.name}`),
        text: `${entry} % des notes saisies (${c.gradesEntered} sur ${c.gradesExpected}).`,
        cta: 'Voir les résultats',
        to: links.grades,
      });
  }
  if (audience === 'school' && s.casesToAcknowledge)
    out.push({
      icon: 'shield',
      title: at(
        `${s.casesToAcknowledge} signalement${s.casesToAcknowledge > 1 ? 's' : ''} confidentiel${s.casesToAcknowledge > 1 ? 's' : ''}`,
      ),
      text: 'Accusé de réception attendu sous 4 h.',
      cta: 'Ouvrir',
      to: links.cases,
      highlight: true,
    });
  if (audience === 'school' && s.pendingLinks)
    out.push({
      icon: 'users',
      title: at(
        `${s.pendingLinks} demande${s.pendingLinks > 1 ? 's' : ''} de rattachement`,
      ),
      text: 'Des parents attendent la validation de l’école.',
      cta: 'Traiter',
      to: links.requests,
    });
  const m = measures(s);
  if (m.activation !== null && m.activation < 50)
    out.push({
      icon: 'user-x',
      title: at('Comptes élèves peu activés'),
      text: `${m.activation} % des comptes élèves activés (${m.t.activated} sur ${m.t.students}).`,
      cta: 'Voir les comptes',
      to: links.accounts,
    });
  return out;
}
