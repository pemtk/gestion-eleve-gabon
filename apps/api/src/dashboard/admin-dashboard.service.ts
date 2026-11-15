import { Inject, Injectable } from '@nestjs/common';
import { ne, sql } from 'drizzle-orm';
import {
  PLAN_ORDER,
  PLAN_PRICES,
  pct,
  spaced,
  type SideItem,
} from '@sge/shared';
import { DB, type Db } from '../db/db.module.js';
import { WEEK } from './measures.js';
import {
  incidents,
  organizations,
  orgSubscriptions,
  users,
} from '../db/schema.js';
import { IndicatorsService, totals } from '../indicators/indicators.service.js';
import { DashboardBody } from './dashboard.shared.js';

/** Vue globale de la plateforme (§10) : écoles, comptes, complétion, revenu estimé et incidents ouverts. */
@Injectable()
export class AdminDashboardService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly indicators: IndicatorsService,
  ) {}

  /** §10 — vue globale de la plateforme. */
  async admin(): Promise<{ body: DashboardBody }> {
    const orgs = await this.db
      .select()
      .from(organizations)
      .orderBy(organizations.id);
    const subs = await this.db.select().from(orgSubscriptions);
    const schools = orgs.filter((o) => o.type === 'École');
    const trials = schools.filter((o) => o.status.startsWith('Essai'));
    const live = schools.filter((o) => o.status !== 'Suspendu');
    const [{ total, activated }] = (await this.db
      .select({
        total: sql<number>`count(*)::int`,
        activated: sql<number>`count(*) filter (where ${users.activated})::int`,
      })
      .from(users)) as [{ total: number; activated: number }];
    const stats = await this.indicators.schools(
      schools.map((o) => o.id),
      WEEK,
    );
    const all = totals(stats.flatMap((s) => s.classes));
    const completion = pct(all.done, all.expected);
    // Revenu récurrent estimé : abonnements actifs hors essais ; l'annuel vaut 10 mois, soit 10/12 du prix mensuel.
    const mrr = subs.reduce((sum, s) => {
      const org = orgs.find((o) => o.id === s.orgId);
      if (
        !s.active ||
        !org ||
        org.status.startsWith('Essai') ||
        org.status === 'Suspendu'
      )
        return sum;
      return (
        sum +
        PLAN_PRICES[s.plan as keyof typeof PLAN_PRICES] *
          (s.period === 'annuelle' ? 10 / 12 : 1)
      );
    }, 0);
    const open = await this.db
      .select()
      .from(incidents)
      .where(ne(incidents.status, 'Résolu'))
      .orderBy(incidents.id);
    const planCounts = PLAN_ORDER.map(
      (p) =>
        [
          p,
          orgs.filter((o) => o.plan === p && o.status !== 'Suspendu').length,
        ] as const,
    );
    const planTotal = planCounts.reduce((n, [, c]) => n + c, 0);
    return {
      body: {
        kpis: [
          {
            label: 'Écoles actives',
            value: String(live.length),
            unit: '',
            sub: `dont ${trials.length} en essai`,
            icon: 'school',
          },
          {
            label: 'Comptes activés',
            value: spaced(activated),
            unit: ` / ${spaced(total)}`,
            sub: 'tous profils',
            icon: 'users',
          },
          {
            label: 'Complétion globale',
            value: completion === null ? '—' : String(completion),
            unit: completion === null ? '' : '%',
            sub: `toutes écoles · ${WEEK} jours`,
            icon: 'list-checks',
          },
          {
            label: 'Revenus récurrents',
            value: spaced(mrr),
            unit: ' FCFA',
            sub: 'par mois (estimation, hors essais)',
            icon: 'banknote',
          },
        ],
        chart: {
          title: 'Organisations par formule',
          sub: 'hors comptes suspendus',
          legendA: 'Actif',
          legendB: 'Faible part',
          rows: planCounts.map(([p, c]) => ({
            label: p,
            pct: pct(c, planTotal) ?? 0,
            display: String(c),
          })),
        },
        side: {
          title: 'Incidents ouverts',
          items: open.length
            ? open.slice(0, 3).map((i, k): SideItem => ({
                icon: i.icon,
                title: i.title,
                text: i.meta,
                cta: 'Voir',
                to: '/admin/incidents',
                highlight: k === 0,
              }))
            : [
                {
                  icon: 'circle-check',
                  title: 'Aucun incident ouvert',
                  text: 'Tout fonctionne normalement.',
                  cta: 'Historique',
                  to: '/admin/incidents',
                },
              ],
        },
        table: {
          title: 'Organisations',
          note: `${orgs.length} au total`,
          columns: '1.8fr 1fr 1fr 1fr 1fr',
          head: ['Organisation', 'Type', 'Formule', 'Statut', 'Échéance'],
          rows: orgs
            .slice(0, 8)
            .map((o) => [o.name, o.type, o.plan, o.status, o.due]),
        },
      },
    };
  }
}
