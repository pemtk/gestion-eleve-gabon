import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DASHBOARDS, PRIVACY_THRESHOLD, maskSmallCell, pct, spaced, type BarRow, type Kpi } from '@sge/shared';
import { DB, type Db } from '../db/db.module.js';
import { organizations } from '../db/schema.js';
import { IndicatorsService, totals, type SchoolStats } from '../indicators/indicators.service.js';

export interface ProvinceRow { province: string; schools: number; cells: (string | null)[] }
const DAYS = 30;

/** Un taux n'est publié que s'il repose sur au moins 10 élèves (§9.2) ; sans mesure, « — ». */
const rate = (part: number, total: number, students: number): string | null => (students < PRIVACY_THRESHOLD ? null : pct(part, total) === null ? '—' : `${pct(part, total)} %`);

/** Filtre région (« Toutes », « Estuaire », « Intérieur » = hors Estuaire, ou une province) et niveau. */
export function filterSchools(stats: SchoolStats[], region: string, level: string): SchoolStats[] {
  return stats.filter((s) => {
    if (!s.province) return false;
    const inRegion = region === 'Toutes' || (region === 'Intérieur' ? s.province !== 'Estuaire' : s.province === region);
    return inRegion && (level === 'Tous' || s.level === level);
  });
}

/** Une ligne par province : activation, complétion, présence (30 jours), signalements — jamais de cellule sous le seuil. */
export function aggregateProvinces(stats: SchoolStats[], cases: Map<string, number>): ProvinceRow[] {
  const provinces = [...new Set(stats.map((s) => s.province!))];
  return provinces.map((province) => {
    const group = stats.filter((s) => s.province === province);
    const t = totals(group.flatMap((s) => s.classes));
    const reports = group.reduce((n, s) => n + (cases.get(s.id) ?? 0), 0);
    const masked = maskSmallCell(reports);
    return {
      province, schools: group.length,
      cells: [rate(t.activated, t.students, t.students), rate(t.done, t.expected, t.students), rate(t.present, t.records, t.students), masked === null ? null : String(masked)],
    };
  }).sort((a, b) => b.schools - a.schools || a.province.localeCompare(b.province, 'fr'));
}

/** Données agrégées et anonymisées (§9) : jamais de nom, cellules de moins de 10 individus masquées. */
@Injectable()
export class PartnerService {
  constructor(@Inject(DB) private readonly db: Db, private readonly indicators: IndicatorsService) {}

  private async stats(): Promise<SchoolStats[]> {
    const ids = (await this.db.select({ id: organizations.id }).from(organizations).where(eq(organizations.type, 'École'))).map((o) => o.id);
    return this.indicators.schools(ids, DAYS);
  }

  private casesBySchool() {
    return this.indicators.casesBySchool();
  }

  async provinces(region: string, level: string) {
    return aggregateProvinces(filterSchools(await this.stats(), region, level), await this.casesBySchool());
  }

  /** Indicateurs nationaux (30 jours) et taux de présence par province. */
  async nationalIndicators() {
    const stats = await this.stats();
    const t = totals(stats.flatMap((s) => s.classes));
    const shown = (v: string | null) => (v === null ? { value: 'masqué', unit: '' } : v === '—' ? { value: '—', unit: '' } : { value: v.replace(' %', ''), unit: '%' });
    const kpi = (label: string, v: string | null, sub: string, icon: string): Kpi => ({ label, ...shown(v), sub, icon });
    const provinces = [...new Set(stats.map((s) => s.province).filter(Boolean))];
    const rows: BarRow[] = aggregateProvinces(stats, new Map()).map((r) => {
      const presence = r.cells[2];
      return presence === null ? { label: r.province, pct: 0, display: 'masqué' } : { label: r.province, pct: presence === '—' ? 0 : parseInt(presence, 10), display: presence === '—' ? '—' : undefined };
    }).sort((a, b) => b.pct - a.pct);
    return {
      kpis: [
        kpi('Taux d’activation', rate(t.activated, t.students, t.students), 'comptes élèves activés', 'user-check'),
        kpi('Complétion des tâches', rate(t.done, t.expected, t.students), `moyenne sur ${DAYS} jours`, 'list-checks'),
        kpi('Taux de présence', rate(t.present, t.records, t.students), `appels saisis sur ${DAYS} jours`, 'calendar-check'),
        { label: 'Établissements', value: spaced(stats.length), unit: '', sub: `dans ${provinces.length} province${provinces.length > 1 ? 's' : ''}`, icon: 'building-2' },
      ],
      chart: { ...DASHBOARDS.partenaire.chart, sub: `${DAYS} derniers jours`, rows },
    };
  }

  async reports() {
    return (await this.indicators.reportCounts()).map((r) => ({ type: r.type, open: maskSmallCell(r.open), inProgress: maskSmallCell(r.inProgress), closed: maskSmallCell(r.closed) }));
  }

  /** Export CSV : les cellules masquées restent vides ; les chiffres sont ceux affichés à l'écran. */
  async exportCsv(dataset: 'signalements' | 'provinces' = 'signalements'): Promise<string> {
    if (dataset === 'provinces') {
      const rows = await this.provinces('Toutes', 'Tous');
      return ['province;établissements;activation;complétion;présence;signalements', ...rows.map((r) => [r.province, r.schools, ...r.cells.map((c) => c ?? '')].join(';'))].join('\n');
    }
    return ['type;ouverts;en cours;clos', ...(await this.reports()).map((r) => [r.type, r.open ?? '', r.inProgress ?? '', r.closed ?? ''].join(';'))].join('\n');
  }
}
