import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { LOW_COMPLETION, pct, pctLabel, spaced } from '@sge/shared';
import { DB, type Db } from '../db/db.module.js';
import { alertsOf } from './alerts.js';
import { byPct } from './charts.js';
import { WEEK, measures } from './measures.js';
import { organizations } from '../db/schema.js';
import { IndicatorsService, totals } from '../indicators/indicators.service.js';
import { DashboardBody } from './dashboard.shared.js';

/** Vue réseau : comparatif des établissements du même diocèse ou réseau que l'école. */
@Injectable()
export class NetworkDashboardService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly indicators: IndicatorsService,
  ) {}

  /** Vue réseau : les établissements du même diocèse ou réseau que l'école (ou l'école seule si elle n'est rattachée à rien). */
  async network(sid: string): Promise<DashboardBody & { kicker: string }> {
    const [me] = await this.db
      .select({ parentId: organizations.parentId })
      .from(organizations)
      .where(eq(organizations.id, sid));
    const [parent] = me?.parentId
      ? await this.db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, me.parentId))
      : [];
    const ids = me?.parentId
      ? (
          await this.db
            .select({ id: organizations.id })
            .from(organizations)
            .where(
              and(
                eq(organizations.parentId, me.parentId),
                eq(organizations.type, 'École'),
              ),
            )
        ).map((r) => r.id)
      : [sid];
    const stats = await this.indicators.schools(ids, WEEK);
    const plans = new Map(
      (
        await this.db
          .select({ id: organizations.id, plan: organizations.plan })
          .from(organizations)
          .where(inArray(organizations.id, ids))
      ).map((o) => [o.id, o.plan]),
    );
    const all = totals(stats.flatMap((s) => s.classes));
    const completion = pct(all.done, all.expected);
    const accounts = stats.reduce((n, s) => n + measures(s).accounts, 0);
    const alerts = stats
      .flatMap((s) => alertsOf(s, 'network', `${s.name} · `))
      .slice(0, 4);
    return {
      kicker: parent?.name ?? 'Votre établissement',
      kpis: [
        {
          label: 'Établissements',
          value: String(stats.length),
          unit: '',
          sub: parent?.name ?? 'Non rattaché à un réseau',
          icon: 'school',
        },
        {
          label: 'Comptes activés',
          value: spaced(accounts),
          unit: '',
          sub: 'élèves et enseignants',
          icon: 'users',
        },
        {
          label: 'Complétion moyenne',
          value: completion === null ? '—' : String(completion),
          unit: completion === null ? '' : '%',
          sub: `${WEEK} derniers jours`,
          icon: 'list-checks',
        },
        {
          label: 'Absences',
          value: String(all.absent),
          unit: '',
          sub: `sur ${WEEK} jours, ${stats.length} école${stats.length > 1 ? 's' : ''}`,
          icon: 'user-x',
        },
      ],
      chart: {
        title: 'Complétion des tâches par école',
        sub: `${WEEK} derniers jours`,
        legendA: 'Normal',
        legendB: `Engagement faible (< ${LOW_COMPLETION} %)`,
        rows: byPct(
          stats.map((s): [string, number | null] => [
            s.name,
            measures(s).completion,
          ]),
        ),
      },
      side: {
        title: 'Alertes du réseau',
        items: alerts.length
          ? alerts
          : [
              {
                icon: 'circle-check',
                title: 'Rien à signaler',
                text: 'Aucune alerte dans le réseau.',
                cta: 'Voir le comparatif',
                to: '/ecole/reseau',
              },
            ],
      },
      table: {
        title: 'Comparatif des établissements',
        note: 'calculé à l’instant',
        columns: '1.8fr 1fr 1fr 1fr 1fr',
        head: [
          'Établissement',
          'Élèves actifs',
          'Parents',
          'Complétion',
          'Formule',
        ],
        rows: stats.map((s) => {
          const m = measures(s);
          return [
            s.name,
            `${m.t.activated} / ${m.t.students}`,
            pctLabel(m.parents),
            pctLabel(m.completion),
            plans.get(s.id) ?? '—',
          ];
        }),
      },
    };
  }
}
