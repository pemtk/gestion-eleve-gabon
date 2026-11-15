import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, inArray } from 'drizzle-orm';
import {
  pct,
  pctLabel,
  schoolStatus,
  spaced,
  type SideItem,
} from '@sge/shared';
import { DB, type Db } from '../db/db.module.js';
import { alertsOf } from './alerts.js';
import { byPct } from './charts.js';
import { WEEK, measures } from './measures.js';
import { userScopes, visitReports } from '../db/schema.js';
import {
  IndicatorsService,
  totals,
  type SchoolStats,
} from '../indicators/indicators.service.js';
import { DashboardBody } from './dashboard.shared.js';

/** Espace agent (§8) : tableau de bord du périmètre, une ligne par école et fiche d'une école. */
@Injectable()
export class AgentDashboardService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly indicators: IndicatorsService,
  ) {}

  private async scopeIds(userId: string): Promise<string[]> {
    return (
      await this.db
        .select({ id: userScopes.orgId })
        .from(userScopes)
        .where(eq(userScopes.userId, userId))
    ).map((r) => r.id);
  }

  /** Une ligne par établissement du périmètre : la même pour le tableau de bord et la liste « Mes écoles ». */
  agentRows(stats: SchoolStats[]) {
    return stats.map((s) => {
      const m = measures(s);
      return {
        name: s.name,
        active: spaced(m.accounts),
        completion: pctLabel(m.completion),
        absences: String(m.t.absent),
        status: schoolStatus({
          activation: m.activation,
          gradeEntry: m.gradeEntry,
          completion: m.completion,
        }),
      };
    });
  }

  /** §8.1 — tableau de bord de l'agent sur son périmètre. */
  async agent(
    userId: string,
  ): Promise<{ body: DashboardBody; kicker: string }> {
    const ids = await this.scopeIds(userId);
    const stats = await this.indicators.schools(ids, WEEK);
    const all = totals(stats.flatMap((s) => s.classes));
    const rows = this.agentRows(stats);
    const alerting = rows.filter((r) => r.status !== 'Actif').length;
    const accounts = stats.reduce((n, s) => n + measures(s).accounts, 0);
    const reports = ids.length
      ? await this.db
          .select()
          .from(visitReports)
          .where(inArray(visitReports.schoolId, ids))
          .orderBy(desc(visitReports.id))
          .limit(3)
      : [];
    const provinces = [
      ...new Set(stats.map((s) => s.province).filter((p): p is string => !!p)),
    ];
    return {
      kicker: `${provinces.length ? provinces.join(', ') : 'Périmètre'} · ${stats.length} établissement${stats.length > 1 ? 's' : ''}`,
      body: {
        kpis: [
          {
            label: 'Comptes activés',
            value: spaced(accounts),
            unit: '',
            sub: 'élèves et enseignants',
            icon: 'users',
          },
          {
            label: 'Complétion moyenne',
            value:
              pct(all.done, all.expected) === null
                ? '—'
                : String(pct(all.done, all.expected)),
            unit: pct(all.done, all.expected) === null ? '' : '%',
            sub: `${WEEK} derniers jours`,
            icon: 'list-checks',
          },
          {
            label: 'Absences signalées',
            value: String(all.absent),
            unit: '',
            sub: `sur ${WEEK} jours`,
            icon: 'user-x',
          },
          {
            label: 'Écoles en alerte',
            value: String(alerting),
            unit: ` / ${stats.length}`,
            sub: 'activation, saisie ou engagement faibles',
            icon: 'circle-alert',
          },
        ],
        chart: {
          title: 'Complétion des tâches',
          sub: `par établissement · ${WEEK} jours`,
          legendA: 'Normal',
          legendB: 'À surveiller',
          rows: byPct(
            stats.map((s): [string, number | null] => [
              s.name,
              measures(s).completion,
            ]),
          ),
        },
        side: {
          title: 'Derniers comptes-rendus',
          items: reports.map((r): SideItem => ({
            icon: 'file-text',
            title: `${r.school} · ${r.date}`,
            text: r.text,
            cta: 'Lire',
            to: '/agent/comptes-rendus',
          })),
        },
        table: {
          title: 'Engagement par école',
          note: `${WEEK} derniers jours`,
          columns: '1.8fr 1fr 1fr 1fr 1.2fr',
          head: ['Établissement', 'Actifs', 'Complétion', 'Absences', 'Statut'],
          rows: rows.map((r) => [
            r.name,
            r.active,
            r.completion,
            r.absences,
            r.status,
          ]),
        },
      },
    };
  }

  /** §8.2 — fiche d'une école du périmètre. */
  async agentSchool(stat: SchoolStats) {
    const m = measures(stat);
    const [last] = await this.db
      .select({ date: visitReports.date })
      .from(visitReports)
      .where(eq(visitReports.schoolId, stat.id))
      .orderBy(desc(visitReports.id))
      .limit(1);
    return {
      kpis: [
        {
          label: 'Comptes activés',
          value: spaced(m.accounts),
          sub: 'élèves et enseignants',
        },
        {
          label: 'Complétion',
          value: pctLabel(m.completion),
          sub: `${WEEK} derniers jours`,
        },
        {
          label: 'Absences',
          value: String(m.t.absent),
          sub: `sur ${WEEK} jours`,
        },
        {
          label: 'Dernière visite',
          value: last?.date ?? '—',
          sub: last ? 'dernier compte-rendu' : 'aucun compte-rendu',
        },
      ],
      activation: [
        ['Élèves', `${m.t.activated} / ${m.t.students}`, m.activation ?? 0],
        ['Parents', `${m.t.withParent} / ${m.t.students}`, m.parents ?? 0],
        [
          'Enseignants',
          `${stat.teachers.active} / ${stat.teachers.total}`,
          pct(stat.teachers.active, stat.teachers.total) ?? 0,
        ],
      ] as [string, string, number][],
      alerts: alertsOf(stat, 'agent').map((a) => ({
        icon: a.icon,
        text: a.title === '' ? a.text : `${a.title} : ${a.text}`,
      })),
      entry: m.gradeEntry ?? 0,
    };
  }
}
