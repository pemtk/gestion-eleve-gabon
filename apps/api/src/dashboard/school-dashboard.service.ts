import { Injectable } from '@nestjs/common';
import {
  LOW_COMPLETION,
  daysSince,
  pct,
  pctLabel,
  spaced,
  type Kpi,
  type SideItem,
} from '@sge/shared';
import { alertsOf } from './alerts.js';
import { byPct, today } from './charts.js';
import { WEEK, measures } from './measures.js';
import { IndicatorsService } from '../indicators/indicators.service.js';
import { DashboardBody } from './dashboard.shared.js';

/** Tableau de bord de l'école (§7.1) : effectifs, complétion, points d'attention et activation par classe, calculés sur 7 jours. */
@Injectable()
export class SchoolDashboardService {
  constructor(private readonly indicators: IndicatorsService) {}

  /** §7.1 — tableau de bord de l'école (période : 7 jours). */
  async school(sid: string): Promise<{ body: DashboardBody }> {
    const [s] = await this.indicators.schools([sid], WEEK);
    if (!s) throw new Error('Établissement introuvable.');
    const m = measures(s);
    const { t } = m;
    const pendingInvites = s.teachers.total - s.teachers.active;
    const kpis: Kpi[] = [
      {
        label: 'Élèves actifs',
        value: spaced(t.activated),
        unit: ` / ${spaced(t.students)}`,
        sub: t.students
          ? `${pctLabel(m.activation)} des comptes activés`
          : 'Aucun élève pour le moment',
        icon: 'backpack',
      },
      {
        label: 'Parents rattachés',
        value: m.parents === null ? '—' : String(m.parents),
        unit: m.parents === null ? '' : '%',
        sub: `${t.withParent} élève${t.withParent > 1 ? 's' : ''} avec au moins un parent`,
        icon: 'users',
      },
      {
        label: 'Enseignants',
        value: String(s.teachers.active),
        unit: ` / ${s.teachers.total}`,
        sub: pendingInvites
          ? `${pendingInvites} invitation${pendingInvites > 1 ? 's' : ''} en attente`
          : 'Aucune invitation en attente',
        icon: 'graduation-cap',
      },
      {
        label: 'Complétion des tâches',
        value: m.completion === null ? '—' : String(m.completion),
        unit: m.completion === null ? '' : '%',
        sub: t.tasks
          ? `sur les ${WEEK} derniers jours`
          : `aucune tâche publiée en ${WEEK} jours`,
        icon: 'list-checks',
      },
    ];
    const alerts = alertsOf(s, 'school');
    const side: SideItem[] = alerts.length
      ? alerts.slice(0, 4)
      : [
          {
            icon: 'circle-check',
            title: 'Rien à signaler',
            text: 'Aucune classe en difficulté, aucun signalement en attente.',
            cta: 'Voir les classes',
            to: '/ecole/configuration?tab=classes',
          },
        ];
    const rows = s.classes.map((c) => {
      const entry = pct(c.gradesEntered, c.gradesExpected);
      const call =
        c.lastAttendance === null
          ? 'Aucun appel'
          : daysSince(c.lastAttendance, today()) <= 3
            ? 'À jour'
            : `En retard · ${daysSince(c.lastAttendance, today())} j`;
      return [
        c.name,
        `${c.activated} / ${c.students}`,
        `${c.withParent} / ${c.students}`,
        pctLabel(entry),
        call,
      ];
    });
    return {
      body: {
        kpis,
        chart: {
          title: 'Complétion des tâches par classe',
          sub: `${WEEK} derniers jours`,
          legendA: 'Normal',
          legendB: `Engagement faible (< ${LOW_COMPLETION} %)`,
          rows: byPct(
            s.classes.map((c): [string, number | null] => [
              c.name,
              pct(c.done, c.expected),
            ]),
          ),
        },
        side: { title: 'À traiter', items: side },
        table: {
          title: 'Activation des comptes',
          note: 'calculé à l’instant',
          columns: '1.4fr 1fr 1fr 1fr 1fr',
          head: ['Classe', 'Élèves', 'Parents', 'Notes saisies', 'Appel'],
          rows,
        },
      },
    };
  }
}
