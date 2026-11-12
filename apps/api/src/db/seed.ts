import { sql } from 'drizzle-orm';
import {
  ABSENCES, ALERT_PREFS, AGENT_USERS, ASSIGNMENTS, CLASSES, CONFIDENTIAL_CASES, CONVERSATION, DEMO_PASSWORD, DEMO_USERS,
  LINK_REQUESTS, ORGANIZATIONS, REWARDS, SCHOOL_YEAR, STUDENT_START, STUDENTS, SUBJECT_GRADES, TASKS, TEACHERS,
  TECH_INCIDENTS, THREADS, VISIT_REPORTS,
} from '@sge/shared';
import { hashPassword } from '../auth/password.js';
import type { Db } from './db.module.js';
import * as t from './schema.js';
import { setSetting } from './settings.js';

const TABLES = [
  t.users, t.otpCodes, t.settings, t.classes, t.students, t.studentParents, t.teachers, t.linkRequests, t.schoolYears,
  t.assignments, t.absences, t.results, t.resultCorrections, t.announcements, t.cases, t.tasks, t.taskInvalidations,
  t.learner, t.subjectGrades, t.rewards, t.alertPrefs, t.attendanceRecords, t.threads, t.messages, t.notificationReads,
  t.organizations, t.orgSubscriptions, t.institutionalUsers, t.incidents, t.visitReports,
];

/** Vide toutes les tables (tests, démonstration). */
export async function truncateAll(db: Db) {
  const names = TABLES.map((tb) => sql.identifier((tb as unknown as { [k: symbol]: string })[Symbol.for('drizzle:Name')]!));
  await db.execute(sql`TRUNCATE ${sql.join(names, sql`, `)} RESTART IDENTITY CASCADE`);
}

const RESULT_ROWS: [string, number | null][] = [
  ['Aïcha Ondo', 15.5], ['Brice Nzé', 12], ['Cyrielle Mba', 17], ['Daniel Obiang', null], ['Emmanuella Moussavou', 9.5], ['Fabrice Mintsa', 13],
];

/**
 * Charge le jeu de démonstration (le design : Lycée Léon Mba, 3ème B…).
 * `onlyIfEmpty` : n'agit que sur une base vide ; sinon remet la base à zéro puis la remplit.
 */
export async function seedDemo(db: Db, opts: { onlyIfEmpty?: boolean } = {}): Promise<boolean> {
  if (opts.onlyIfEmpty) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.users);
    if (n > 0) return false;
  } else {
    await truncateAll(db);
  }
  const hash = hashPassword(DEMO_PASSWORD);

  await db.transaction(async (tx) => {
    await tx.insert(t.users).values(Object.values(DEMO_USERS).map((u) => ({ id: u.id, phone: u.phone, name: u.name, initials: u.initials, role: u.role, title: u.title, organization: u.organization ?? null, passwordHash: hash, activated: true })));
    await tx.insert(t.classes).values(CLASSES.map((c) => ({ id: c.id, name: c.name, level: c.level, capacity: c.capacity, studentCount: c.students, completion: c.completion, alert: c.alert ?? null })));
    await tx.insert(t.students).values(STUDENTS.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, classId: s.classId, phone: s.phone, code: s.code, activated: s.activated })));
    const parents = STUDENTS.flatMap((s) => s.parents.map((p) => ({ studentId: s.id, name: p.name, relation: p.relation })));
    if (parents.length) await tx.insert(t.studentParents).values(parents);
    await tx.insert(t.teachers).values(TEACHERS);
    await tx.insert(t.linkRequests).values(LINK_REQUESTS.map((r) => ({ id: r.id, parent: r.parent, relation: r.relation, child: r.child, meta: r.meta })));
    await tx.insert(t.schoolYears).values({ id: 'current', label: SCHOOL_YEAR.label, start: SCHOOL_YEAR.start, end: SCHOOL_YEAR.end, active: SCHOOL_YEAR.active, terms: SCHOOL_YEAR.terms });
    await tx.insert(t.assignments).values(ASSIGNMENTS);
    await tx.insert(t.absences).values(ABSENCES);
    await tx.insert(t.results).values(RESULT_ROWS.map(([student, value], i) => ({ id: `res${i}`, student, value, coefficient: 2, published: value !== null })));
    await tx.insert(t.cases).values(CONFIDENTIAL_CASES.map((c) => ({ id: c.id, reporter: c.reporter, className: c.className, type: c.type, received: c.received, student: c.student, text: c.text })));
    await tx.insert(t.tasks).values(TASKS.map((k) => ({ id: k.id, title: k.title, subject: k.subject, type: k.type, due: k.due, status: k.status, estimate: k.estimate })));
    await tx.insert(t.learner).values({ userId: DEMO_USERS.eleve.id, points: STUDENT_START.points, streak: STUDENT_START.streak, doneToday: STUDENT_START.doneToday, history: [] });
    await tx.insert(t.subjectGrades).values(SUBJECT_GRADES.map((g) => ({ subject: g.subject, average: g.average, coefficient: g.coefficient, notes: g.notes })));
    await tx.insert(t.rewards).values(REWARDS);
    await tx.insert(t.alertPrefs).values(ALERT_PREFS);

    const threadRows = (['eleve', 'parent', 'enseignant'] as const).flatMap((role) => THREADS[role].map((th) => ({ id: th.id, role, initials: th.initials, name: th.name, kind: th.kind, last: th.last, time: th.time, unread: th.unread, icon: th.icon ?? null })));
    await tx.insert(t.threads).values(threadRows);
    // Conversation d'exemple : vue du parent (fil th1), de l'élève (th9) et de l'enseignant (th6).
    for (const [threadId, me, other] of [['th1', 'parent', 'enseignant'], ['th9', 'eleve', 'enseignant'], ['th6', 'enseignant', 'parent']] as const) {
      await tx.insert(t.messages).values(CONVERSATION.map((m, i) => ({ threadId, clientId: `seed-${threadId}-${i}`, senderRole: m.mine ? me : other, text: m.text, image: !!m.image, time: m.time })));
    }

    await tx.insert(t.organizations).values(ORGANIZATIONS.map((o) => ({ id: o.id, name: o.name, type: o.type, plan: o.plan, status: o.status, due: o.due, parentId: o.parentId ?? null })));
    await tx.insert(t.orgSubscriptions).values(ORGANIZATIONS.map((o) => ({ orgId: o.id, plan: o.plan, period: 'annuelle', active: o.status !== 'Suspendu' })));
    await tx.insert(t.institutionalUsers).values(AGENT_USERS.map((u) => ({ name: u.name, role: u.role, scope: u.scope, status: u.status })));
    await tx.insert(t.incidents).values(TECH_INCIDENTS.map((i) => ({ id: i.id, icon: i.icon, title: i.title, when: i.when, tone: i.tone, status: i.status, meta: i.meta, description: i.description, table: i.table, action: i.action, actionIcon: i.actionIcon })));
    await tx.insert(t.visitReports).values(VISIT_REPORTS.map((v) => ({ school: v.school, date: v.date, text: v.text })));
  });

  await setSetting(db, 'subscription', { plan: 'Standard', suspended: false, requestedPlan: null });
  await setSetting(db, 'referent', { name: 'Rosine Mba', confirmed: true });
  return true;
}
