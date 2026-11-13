import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';

export interface ClassStats {
  id: string;
  name: string;
  students: number;
  /** Comptes élèves activés (code SMS saisi). */
  activated: number;
  /** Élèves ayant au moins un parent rattaché. */
  withParent: number;
  /** Tâches publiées dans la période, et complétions attendues (tâches × élèves) / réalisées. */
  tasks: number;
  expected: number;
  done: number;
  /** Notes attendues (évaluations × élèves) / saisies. */
  gradesExpected: number;
  gradesEntered: number;
  /** Appels de la période : lignes, présents (présent + retard), absents. */
  records: number;
  present: number;
  absent: number;
  lastAttendance: string | null;
}

export interface SchoolStats {
  id: string;
  name: string;
  province: string | null;
  level: string | null;
  classes: ClassStats[];
  teachers: { total: number; active: number };
  /** Signalements confidentiels reçus mais pas encore accusés (accusé attendu sous 4 h). */
  casesToAcknowledge: number;
  /** Demandes de rattachement parent en attente de décision. */
  pendingLinks: number;
  /** Absences de la période sans justification. */
  unjustifiedAbsences: number;
}

export const sum = <T>(rows: T[], pick: (r: T) => number): number => rows.reduce((n, r) => n + pick(r), 0);
export const totals = (classes: ClassStats[]) => ({
  students: sum(classes, (c) => c.students), activated: sum(classes, (c) => c.activated), withParent: sum(classes, (c) => c.withParent),
  tasks: sum(classes, (c) => c.tasks), expected: sum(classes, (c) => c.expected), done: sum(classes, (c) => c.done),
  gradesExpected: sum(classes, (c) => c.gradesExpected), gradesEntered: sum(classes, (c) => c.gradesEntered),
  records: sum(classes, (c) => c.records), present: sum(classes, (c) => c.present), absent: sum(classes, (c) => c.absent),
});

const list = (ids: string[]): SQL => sql.join(ids.map((i) => sql`${i}`), sql`, `);
const n = (v: unknown) => Number(v ?? 0);

/**
 * Calcul des indicateurs à partir des données réelles (comptes activés, tâches terminées, appels, notes saisies, signalements).
 * Toutes les mesures portent sur une période glissante (`days`) : tâches publiées, appels et absences de cette période.
 * Un dénominateur nul donne « pas de mesure », jamais 0 %.
 */
@Injectable()
export class IndicatorsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  private async rows<T>(query: SQL): Promise<T[]> {
    return (await this.db.execute(query)).rows as T[];
  }

  /** Mesures par établissement et par classe pour les établissements demandés. */
  async schools(ids: string[], days: number): Promise<SchoolStats[]> {
    if (!ids.length) return [];
    const since = new Date(Date.now() - days * 86_400_000);
    const sinceDay = since.toISOString().slice(0, 10);
    const [orgs, students, tasks, done, grades, attendance, teachers, cases, links] = await Promise.all([
      this.rows<{ id: string; name: string; province: string | null; level: string | null }>(sql`SELECT id, name, province, level FROM organizations WHERE id IN (${list(ids)}) ORDER BY name`),
      this.rows<{ school_id: string; class_id: string; class_name: string; total: number; activated: number; with_parent: number }>(sql`
        SELECT s.school_id, s.class_id, c.name AS class_name, count(*)::int AS total,
               count(*) FILTER (WHERE COALESCE(u.activated, s.activated))::int AS activated,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM student_parents p WHERE p.student_id = s.id))::int AS with_parent
        FROM students s JOIN classes c ON c.id = s.class_id LEFT JOIN users u ON u.id = s.user_id
        WHERE s.school_id IN (${list(ids)}) GROUP BY s.school_id, s.class_id, c.name`),
      this.rows<{ class_id: string; total: number }>(sql`SELECT class_id, count(*)::int AS total FROM tasks WHERE school_id IN (${list(ids)}) AND created_at >= ${since} GROUP BY class_id`),
      this.rows<{ class_id: string; total: number }>(sql`
        SELECT t.class_id, count(*)::int AS total FROM task_completions tc
        JOIN tasks t ON t.id = tc.task_id JOIN students st ON st.id = tc.student_id AND st.class_id = t.class_id
        WHERE t.school_id IN (${list(ids)}) AND t.created_at >= ${since} AND tc.status = 'done' AND tc.invalidated_at IS NULL GROUP BY t.class_id`),
      this.rows<{ class_id: string; evaluations: number; entered: number }>(sql`
        SELECT e.class_id, count(DISTINCT e.id)::int AS evaluations, count(g.id)::int AS entered
        FROM evaluations e LEFT JOIN grades g ON g.evaluation_id = e.id WHERE e.school_id IN (${list(ids)}) GROUP BY e.class_id`),
      this.rows<{ class_id: string; records: number; present: number; absent: number; unjustified: number; last: string | null }>(sql`
        SELECT class_id, count(*) FILTER (WHERE date >= ${sinceDay})::int AS records,
               count(*) FILTER (WHERE date >= ${sinceDay} AND status IN ('P', 'R'))::int AS present,
               count(*) FILTER (WHERE date >= ${sinceDay} AND status = 'A')::int AS absent,
               count(*) FILTER (WHERE date >= ${sinceDay} AND status = 'A' AND justification IS NULL)::int AS unjustified,
               max(date) AS last
        FROM attendance_records WHERE school_id IN (${list(ids)}) GROUP BY class_id`),
      this.rows<{ school_id: string; total: number; active: number }>(sql`SELECT school_id, count(*)::int AS total, count(*) FILTER (WHERE status = 'Activé')::int AS active FROM teachers WHERE school_id IN (${list(ids)}) GROUP BY school_id`),
      this.rows<{ school_id: string; total: number }>(sql`SELECT school_id, count(*)::int AS total FROM cases WHERE school_id IN (${list(ids)}) AND kind = 'confidentiel' AND step = 1 GROUP BY school_id`),
      this.rows<{ school_id: string; total: number }>(sql`SELECT school_id, count(*)::int AS total FROM link_requests WHERE school_id IN (${list(ids)}) AND decision IS NULL GROUP BY school_id`),
    ]);
    const by = <T extends { class_id: string }>(rows: T[]) => new Map(rows.map((r) => [r.class_id, r]));
    const taskBy = by(tasks), doneBy = by(done), gradeBy = by(grades), attBy = by(attendance);
    return orgs.map((o): SchoolStats => {
      const classes = students.filter((s) => s.school_id === o.id).map((s): ClassStats => {
        const t = n(taskBy.get(s.class_id)?.total);
        const g = gradeBy.get(s.class_id);
        const a = attBy.get(s.class_id);
        return {
          id: s.class_id, name: s.class_name, students: n(s.total), activated: n(s.activated), withParent: n(s.with_parent),
          tasks: t, expected: t * n(s.total), done: n(doneBy.get(s.class_id)?.total),
          gradesExpected: n(g?.evaluations) * n(s.total), gradesEntered: n(g?.entered),
          records: n(a?.records), present: n(a?.present), absent: n(a?.absent), lastAttendance: a?.last ?? null,
        };
      }).sort((x, y) => x.name.localeCompare(y.name, 'fr', { numeric: true }));
      const t = teachers.find((x) => x.school_id === o.id);
      return {
        id: o.id, name: o.name, province: o.province, level: o.level, classes,
        teachers: { total: n(t?.total), active: n(t?.active) },
        casesToAcknowledge: n(cases.find((c) => c.school_id === o.id)?.total),
        pendingLinks: n(links.find((l) => l.school_id === o.id)?.total),
        unjustifiedAbsences: sum(classes.map((c) => c.id), (id) => n(attBy.get(id)?.unjustified)),
      };
    });
  }

  /** Nombre de signalements (tous types) par établissement. */
  async casesBySchool(): Promise<Map<string, number>> {
    const rows = await this.rows<{ school_id: string; total: number }>(sql`SELECT school_id, count(*)::int AS total FROM cases GROUP BY school_id`);
    return new Map(rows.map((r) => [r.school_id, n(r.total)]));
  }

  /** Signalements comptés par type et par statut (ouvert : reçu ou accusé ; en cours : évaluation ou plan d'action ; clos). */
  async reportCounts(): Promise<{ type: string; open: number; inProgress: number; closed: number }[]> {
    const rows = await this.rows<{ label: string; open: number; in_progress: number; closed: number }>(sql`
      SELECT CASE WHEN kind = 'conduite' THEN 'Conduite / engagement' ELSE 'Confidentiel — ' || lower(type) END AS label,
             count(*) FILTER (WHERE step <= 2)::int AS open, count(*) FILTER (WHERE step IN (3, 4))::int AS in_progress, count(*) FILTER (WHERE step = 5)::int AS closed
      FROM cases GROUP BY 1 ORDER BY 1`);
    return rows.map((r) => ({ type: r.label, open: n(r.open), inProgress: n(r.in_progress), closed: n(r.closed) }));
  }
}
