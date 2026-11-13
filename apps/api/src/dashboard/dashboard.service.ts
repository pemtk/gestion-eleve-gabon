import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  LOW_COMPLETION, LOW_GRADE_ENTRY, PLAN_ORDER, PLAN_PRICES, daysSince, pct, pctLabel, schoolStatus, spaced,
  type BarRow, type DashboardData, type Kpi, type NavItem, type SideItem,
} from '@sge/shared';
import { DB, type Db } from '../db/db.module.js';
import { incidents, organizations, orgSubscriptions, userScopes, users, visitReports } from '../db/schema.js';
import { IndicatorsService, totals, type SchoolStats } from '../indicators/indicators.service.js';

type Body = Pick<DashboardData, 'kpis' | 'chart' | 'side' | 'table'>;
const WEEK = 7;
const bar = (label: string, value: number | null): BarRow => ({ label, pct: value ?? 0, display: value === null ? '—' : undefined });
const byPct = (rows: [string, number | null][]) => rows.sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1)).map(([label, v]) => bar(label, v));
const today = () => new Date().toISOString().slice(0, 10);

/** Les pastilles de navigation reflètent les données : sans valeur, pas de pastille. */
export function withBadges(nav: NavItem[], badges: Record<string, number>): NavItem[] {
  return nav.map(({ badge: _static, ...item }) => (badges[item.to] ? { ...item, badge: String(badges[item.to]) } : item));
}

/** Mesures d'un établissement sous forme d'indicateurs prêts à afficher. */
export function measures(s: SchoolStats) {
  const t = totals(s.classes);
  return {
    t, activation: pct(t.activated, t.students), parents: pct(t.withParent, t.students), completion: pct(t.done, t.expected),
    gradeEntry: pct(t.gradesEntered, t.gradesExpected), presence: pct(t.present, t.records),
    accounts: t.activated + s.teachers.active,
  };
}

/** Points d'attention d'un établissement (même liste pour la direction, l'agent et le réseau). */
export function alertsOf(s: SchoolStats, prefix = ''): (SideItem & { text: string })[] {
  const out: SideItem[] = [];
  const at = (x: string) => `${prefix}${x}`;
  for (const c of s.classes) {
    const completion = pct(c.done, c.expected);
    if (completion !== null && completion < LOW_COMPLETION) out.push({ icon: 'circle-alert', title: at(`${c.name} — engagement faible`), text: `${completion} % de complétion sur ${WEEK} jours (${c.done} tâches terminées sur ${c.expected}).`, cta: 'Voir la classe', highlight: true });
  }
  for (const c of s.classes) {
    const entry = pct(c.gradesEntered, c.gradesExpected);
    if (entry !== null && entry < LOW_GRADE_ENTRY) out.push({ icon: 'clock', title: at(`Notes en retard · ${c.name}`), text: `${entry} % des notes saisies (${c.gradesEntered} sur ${c.gradesExpected}).`, cta: 'Relancer' });
  }
  if (s.casesToAcknowledge) out.push({ icon: 'shield', title: at(`${s.casesToAcknowledge} signalement${s.casesToAcknowledge > 1 ? 's' : ''} confidentiel${s.casesToAcknowledge > 1 ? 's' : ''}`), text: 'Accusé de réception attendu sous 4 h.', cta: 'Ouvrir', highlight: true });
  if (s.pendingLinks) out.push({ icon: 'users', title: at(`${s.pendingLinks} demande${s.pendingLinks > 1 ? 's' : ''} de rattachement`), text: 'Des parents attendent la validation de l’école.', cta: 'Traiter' });
  const m = measures(s);
  if (m.activation !== null && m.activation < 50) out.push({ icon: 'user-x', title: at('Comptes élèves peu activés'), text: `${m.activation} % des comptes élèves activés (${m.t.activated} sur ${m.t.students}).`, cta: 'Renvoyer les invitations' });
  return out as (SideItem & { text: string })[];
}

@Injectable()
export class DashboardService {
  constructor(@Inject(DB) private readonly db: Db, private readonly indicators: IndicatorsService) {}

  /** §7.1 — tableau de bord de l'école (période : 7 jours). */
  async school(sid: string): Promise<{ body: Body; badges: Record<string, number> }> {
    const [s] = await this.indicators.schools([sid], WEEK);
    if (!s) throw new Error('Établissement introuvable.');
    const m = measures(s);
    const { t } = m;
    const pendingInvites = s.teachers.total - s.teachers.active;
    const kpis: Kpi[] = [
      { label: 'Élèves actifs', value: spaced(t.activated), unit: ` / ${spaced(t.students)}`, sub: t.students ? `${pctLabel(m.activation)} des comptes activés` : 'Aucun élève pour le moment', icon: 'backpack' },
      { label: 'Parents rattachés', value: m.parents === null ? '—' : String(m.parents), unit: m.parents === null ? '' : '%', sub: `${t.withParent} élève${t.withParent > 1 ? 's' : ''} avec au moins un parent`, icon: 'users' },
      { label: 'Enseignants', value: String(s.teachers.active), unit: ` / ${s.teachers.total}`, sub: pendingInvites ? `${pendingInvites} invitation${pendingInvites > 1 ? 's' : ''} en attente` : 'Aucune invitation en attente', icon: 'graduation-cap' },
      { label: 'Complétion des tâches', value: m.completion === null ? '—' : String(m.completion), unit: m.completion === null ? '' : '%', sub: t.tasks ? `sur les ${WEEK} derniers jours` : `aucune tâche publiée en ${WEEK} jours`, icon: 'list-checks' },
    ];
    const alerts = alertsOf(s);
    const side: SideItem[] = alerts.length ? alerts.slice(0, 4) : [{ icon: 'circle-check', title: 'Rien à signaler', text: 'Aucune classe en difficulté, aucun signalement en attente.', cta: 'Voir les classes' }];
    const rows = s.classes.map((c) => {
      const entry = pct(c.gradesEntered, c.gradesExpected);
      const call = c.lastAttendance === null ? 'Aucun appel' : daysSince(c.lastAttendance, today()) <= 3 ? 'À jour' : `En retard · ${daysSince(c.lastAttendance, today())} j`;
      return [c.name, `${c.activated} / ${c.students}`, `${c.withParent} / ${c.students}`, pctLabel(entry), call];
    });
    return {
      badges: { '/ecole/utilisateurs': s.pendingLinks, '/ecole/absences': s.unjustifiedAbsences, '/ecole/vie-scolaire': s.casesToAcknowledge },
      body: {
        kpis,
        chart: { title: 'Complétion des tâches par classe', sub: `${WEEK} derniers jours`, legendA: 'Normal', legendB: `Engagement faible (< ${LOW_COMPLETION} %)`, rows: byPct(s.classes.map((c): [string, number | null] => [c.name, pct(c.done, c.expected)])) },
        side: { title: 'À traiter', items: side },
        table: { title: 'Activation des comptes', note: 'calculé à l’instant', columns: '1.4fr 1fr 1fr 1fr 1fr', head: ['Classe', 'Élèves', 'Parents', 'Notes saisies', 'Appel'], rows },
      },
    };
  }

  private async scopeIds(userId: string): Promise<string[]> {
    return (await this.db.select({ id: userScopes.orgId }).from(userScopes).where(eq(userScopes.userId, userId))).map((r) => r.id);
  }

  /** Une ligne par établissement du périmètre : la même pour le tableau de bord et la liste « Mes écoles ». */
  agentRows(stats: SchoolStats[]) {
    return stats.map((s) => {
      const m = measures(s);
      return { name: s.name, active: spaced(m.accounts), completion: pctLabel(m.completion), absences: String(m.t.absent), status: schoolStatus({ activation: m.activation, gradeEntry: m.gradeEntry, completion: m.completion }) };
    });
  }

  /** §8.1 — tableau de bord de l'agent sur son périmètre. */
  async agent(userId: string): Promise<{ body: Body; kicker: string; badges: Record<string, number> }> {
    const ids = await this.scopeIds(userId);
    const stats = await this.indicators.schools(ids, WEEK);
    const all = totals(stats.flatMap((s) => s.classes));
    const rows = this.agentRows(stats);
    const alerting = rows.filter((r) => r.status !== 'Actif').length;
    const accounts = stats.reduce((n, s) => n + measures(s).accounts, 0);
    const reports = ids.length ? await this.db.select().from(visitReports).where(inArray(visitReports.schoolId, ids)).orderBy(desc(visitReports.id)).limit(3) : [];
    const provinces = [...new Set(stats.map((s) => s.province).filter((p): p is string => !!p))];
    const alertCount = stats.reduce((n, s) => n + alertsOf(s).length, 0);
    return {
      kicker: `${provinces.length ? provinces.join(', ') : 'Périmètre'} · ${stats.length} établissement${stats.length > 1 ? 's' : ''}`,
      badges: { '/agent': stats.length, '/agent/alertes': alertCount },
      body: {
        kpis: [
          { label: 'Comptes activés', value: spaced(accounts), unit: '', sub: 'élèves et enseignants', icon: 'users' },
          { label: 'Complétion moyenne', value: pct(all.done, all.expected) === null ? '—' : String(pct(all.done, all.expected)), unit: pct(all.done, all.expected) === null ? '' : '%', sub: `${WEEK} derniers jours`, icon: 'list-checks' },
          { label: 'Absences signalées', value: String(all.absent), unit: '', sub: `sur ${WEEK} jours`, icon: 'user-x' },
          { label: 'Écoles en alerte', value: String(alerting), unit: ` / ${stats.length}`, sub: 'activation, saisie ou engagement faibles', icon: 'circle-alert' },
        ],
        chart: { title: 'Complétion des tâches', sub: `par établissement · ${WEEK} jours`, legendA: 'Normal', legendB: 'À surveiller', rows: byPct(stats.map((s): [string, number | null] => [s.name, measures(s).completion])) },
        side: { title: 'Derniers comptes-rendus', items: reports.map((r): SideItem => ({ icon: 'file-text', title: `${r.school} · ${r.date}`, text: r.text, cta: 'Lire' })) },
        table: { title: 'Engagement par école', note: `${WEEK} derniers jours`, columns: '1.8fr 1fr 1fr 1fr 1.2fr', head: ['Établissement', 'Actifs', 'Complétion', 'Absences', 'Statut'], rows: rows.map((r) => [r.name, r.active, r.completion, r.absences, r.status]) },
      },
    };
  }

  /** §8.2 — fiche d'une école du périmètre. */
  async agentSchool(stat: SchoolStats) {
    const m = measures(stat);
    const [last] = await this.db.select({ date: visitReports.date }).from(visitReports).where(eq(visitReports.schoolId, stat.id)).orderBy(desc(visitReports.id)).limit(1);
    return {
      kpis: [
        { label: 'Comptes activés', value: spaced(m.accounts), sub: 'élèves et enseignants' },
        { label: 'Complétion', value: pctLabel(m.completion), sub: `${WEEK} derniers jours` },
        { label: 'Absences', value: String(m.t.absent), sub: `sur ${WEEK} jours` },
        { label: 'Dernière visite', value: last?.date ?? '—', sub: last ? 'dernier compte-rendu' : 'aucun compte-rendu' },
      ],
      activation: [
        ['Élèves', `${m.t.activated} / ${m.t.students}`, m.activation ?? 0],
        ['Parents', `${m.t.withParent} / ${m.t.students}`, m.parents ?? 0],
        ['Enseignants', `${stat.teachers.active} / ${stat.teachers.total}`, pct(stat.teachers.active, stat.teachers.total) ?? 0],
      ] as [string, string, number][],
      alerts: alertsOf(stat).map((a) => ({ icon: a.icon, text: a.title === '' ? a.text : `${a.title} : ${a.text}` })),
      entry: m.gradeEntry ?? 0,
    };
  }

  /** Vue réseau : les établissements du même diocèse ou réseau que l'école (ou l'école seule si elle n'est rattachée à rien). */
  async network(sid: string): Promise<Body & { kicker: string }> {
    const [me] = await this.db.select({ parentId: organizations.parentId }).from(organizations).where(eq(organizations.id, sid));
    const [parent] = me?.parentId ? await this.db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, me.parentId)) : [];
    const ids = me?.parentId
      ? (await this.db.select({ id: organizations.id }).from(organizations).where(and(eq(organizations.parentId, me.parentId), eq(organizations.type, 'École')))).map((r) => r.id)
      : [sid];
    const stats = await this.indicators.schools(ids, WEEK);
    const plans = new Map((await this.db.select({ id: organizations.id, plan: organizations.plan }).from(organizations).where(inArray(organizations.id, ids))).map((o) => [o.id, o.plan]));
    const all = totals(stats.flatMap((s) => s.classes));
    const completion = pct(all.done, all.expected);
    const accounts = stats.reduce((n, s) => n + measures(s).accounts, 0);
    const alerts = stats.flatMap((s) => alertsOf(s, `${s.name} · `)).slice(0, 4);
    return {
      kicker: parent?.name ?? 'Votre établissement',
      kpis: [
        { label: 'Établissements', value: String(stats.length), unit: '', sub: parent?.name ?? 'Non rattaché à un réseau', icon: 'school' },
        { label: 'Comptes activés', value: spaced(accounts), unit: '', sub: 'élèves et enseignants', icon: 'users' },
        { label: 'Complétion moyenne', value: completion === null ? '—' : String(completion), unit: completion === null ? '' : '%', sub: `${WEEK} derniers jours`, icon: 'list-checks' },
        { label: 'Absences', value: String(all.absent), unit: '', sub: `sur ${WEEK} jours, ${stats.length} école${stats.length > 1 ? 's' : ''}`, icon: 'user-x' },
      ],
      chart: { title: 'Complétion des tâches par école', sub: `${WEEK} derniers jours`, legendA: 'Normal', legendB: `Engagement faible (< ${LOW_COMPLETION} %)`, rows: byPct(stats.map((s): [string, number | null] => [s.name, measures(s).completion])) },
      side: { title: 'Alertes du réseau', items: alerts.length ? alerts : [{ icon: 'circle-check', title: 'Rien à signaler', text: 'Aucune alerte dans le réseau.', cta: 'Voir le comparatif' }] },
      table: {
        title: 'Comparatif des établissements', note: 'calculé à l’instant', columns: '1.8fr 1fr 1fr 1fr 1fr', head: ['Établissement', 'Élèves actifs', 'Parents', 'Complétion', 'Formule'],
        rows: stats.map((s) => { const m = measures(s); return [s.name, `${m.t.activated} / ${m.t.students}`, pctLabel(m.parents), pctLabel(m.completion), plans.get(s.id) ?? '—']; }),
      },
    };
  }

  /** §10 — vue globale de la plateforme. */
  async admin(): Promise<{ body: Body; badges: Record<string, number> }> {
    const orgs = await this.db.select().from(organizations).orderBy(organizations.id);
    const subs = await this.db.select().from(orgSubscriptions);
    const schools = orgs.filter((o) => o.type === 'École');
    const trials = schools.filter((o) => o.status.startsWith('Essai'));
    const live = schools.filter((o) => o.status !== 'Suspendu');
    const [{ total, activated }] = (await this.db.select({ total: sql<number>`count(*)::int`, activated: sql<number>`count(*) filter (where ${users.activated})::int` }).from(users)) as [{ total: number; activated: number }];
    const stats = await this.indicators.schools(schools.map((o) => o.id), WEEK);
    const all = totals(stats.flatMap((s) => s.classes));
    const completion = pct(all.done, all.expected);
    // Revenu récurrent estimé : abonnements actifs hors essais ; l'annuel vaut 10 mois, soit 10/12 du prix mensuel.
    const mrr = subs.reduce((sum, s) => {
      const org = orgs.find((o) => o.id === s.orgId);
      if (!s.active || !org || org.status.startsWith('Essai') || org.status === 'Suspendu') return sum;
      return sum + PLAN_PRICES[s.plan as keyof typeof PLAN_PRICES] * (s.period === 'annuelle' ? 10 / 12 : 1);
    }, 0);
    const open = await this.db.select().from(incidents).where(ne(incidents.status, 'Résolu')).orderBy(incidents.id);
    const planCounts = PLAN_ORDER.map((p) => [p, orgs.filter((o) => o.plan === p && o.status !== 'Suspendu').length] as const);
    const planTotal = planCounts.reduce((n, [, c]) => n + c, 0);
    const requested = await this.db.select({ id: organizations.id }).from(organizations).where(sql`${organizations.id} in (select org_id from org_subscriptions where requested_plan is not null)`);
    return {
      badges: { '/admin/abonnements': requested.length, '/admin/incidents': open.length },
      body: {
        kpis: [
          { label: 'Écoles actives', value: String(live.length), unit: '', sub: `dont ${trials.length} en essai`, icon: 'school' },
          { label: 'Comptes activés', value: spaced(activated), unit: ` / ${spaced(total)}`, sub: 'tous profils', icon: 'users' },
          { label: 'Complétion globale', value: completion === null ? '—' : String(completion), unit: completion === null ? '' : '%', sub: `toutes écoles · ${WEEK} jours`, icon: 'list-checks' },
          mrr >= 1_000_000
            ? { label: 'Revenus récurrents', value: (mrr / 1_000_000).toFixed(1).replace('.', ','), unit: 'M', sub: 'FCFA / mois (estimation, hors essais)', icon: 'banknote' }
            : { label: 'Revenus récurrents', value: spaced(mrr / 1000), unit: ' k', sub: 'FCFA / mois (estimation, hors essais)', icon: 'banknote' },
        ],
        chart: { title: 'Organisations par formule', sub: 'hors comptes suspendus', legendA: 'Actif', legendB: 'Faible part', rows: planCounts.map(([p, c]) => ({ label: p, pct: pct(c, planTotal) ?? 0, display: String(c) })) },
        side: { title: 'Incidents ouverts', items: open.length ? open.slice(0, 3).map((i, k): SideItem => ({ icon: i.icon, title: i.title, text: i.meta, cta: 'Voir', highlight: k === 0 })) : [{ icon: 'circle-check', title: 'Aucun incident ouvert', text: 'Tout fonctionne normalement.', cta: 'Historique' }] },
        table: { title: 'Organisations', note: `${orgs.length} au total`, columns: '1.8fr 1fr 1fr 1fr 1fr', head: ['Organisation', 'Type', 'Formule', 'Statut', 'Échéance'], rows: orgs.slice(0, 8).map((o) => [o.name, o.type, o.plan, o.status, o.due]) },
      },
    };
  }
}
