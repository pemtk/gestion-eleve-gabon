import { sql } from 'drizzle-orm';
import {
  ATTENDANCE_SEED, FOLLOW_UP, ALERT_PREFS, DEMO_SCHOOL_ID, JUNIOR, THIRD_SCHOOL_ID, WEEK_MINUTES, SECOND_SCHOOL_DATA, SECOND_SCHOOL_DIRECTOR, SECOND_SCHOOL_ID, AGENT_USERS, ASSIGNMENTS, CLASSES, CONFIDENTIAL_CASES, CONVERSATION, DEMO_PASSWORD, DEMO_USERS,
  LINK_REQUESTS, ORGANIZATIONS, REWARDS, SCHOOL_YEAR, STUDENT_START, STUDENTS, SUBJECT_GRADES, TASKS, TEACHERS,
  TECH_INCIDENTS, THREADS, VISIT_REPORTS,
} from '@sge/shared';
import { initials, normalizePhone } from '@sge/shared';
import { hashPassword } from '../auth/password.js';
import type { Db } from './db.module.js';
import * as t from './schema.js';

const TABLES = [
  t.users, t.otpCodes, t.settings, t.classes, t.students, t.studentParents, t.teachers, t.linkRequests, t.schoolYears,
  t.assignments, t.evaluations, t.grades, t.gradeCorrections, t.schoolSubjects, t.announcements, t.cases, t.tasks, t.taskCompletions,
  t.learner, t.workSessions, t.rewards, t.alertPrefs, t.attendanceRecords, t.threads, t.messages, t.notificationReads,
  t.organizations, t.orgSubscriptions, t.institutionalUsers, t.incidents, t.visitReports, t.rateLimits, t.refreshTokens, t.auditLog,
];

/** Vide toutes les tables (tests, démonstration). */
export async function truncateAll(db: Db) {
  const names = TABLES.map((tb) => sql.identifier((tb as unknown as { [k: symbol]: string })[Symbol.for('drizzle:Name')]!));
  await db.execute(sql`TRUNCATE ${sql.join(names, sql`, `)} RESTART IDENTITY CASCADE`);
  await db.execute(sql`ALTER SEQUENCE case_number_seq RESTART WITH 300`);
}

const MONTHS: Record<string, string> = { 'oct.': '10', 'nov.': '11', 'sept.': '09', 'déc.': '12' };
/** « 24 oct. » → 2026-10-24 */
const isoOf = (label: string) => { const [d, m] = label.split(' '); return `2026-${MONTHS[m!] ?? '10'}-${String(d).padStart(2, '0')}`; };
const slug = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
/** Notes supplémentaires du « Devoir surveillé » de mathématiques (3ème B), en plus de celle d'Aïcha. */
const DEVOIR_GRADES: [string, number][] = [['s3', 17], ['s9', 12], ['s10', 9.5], ['s11', 13]];

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
  const S = DEMO_SCHOOL_ID;
  const STUDENT_ID = DEMO_USERS.eleve.id;
  const PARENT_ID = DEMO_USERS.parent.id;

  await db.transaction(async (tx) => {
    // 1. Organisations d'abord : tout le reste s'y rattache.
    await tx.insert(t.organizations).values(ORGANIZATIONS.map((o) => ({ id: o.id, name: o.name, type: o.type, plan: o.plan, status: o.status, due: o.due, parentId: o.parentId ?? null })));
    await tx.insert(t.orgSubscriptions).values(ORGANIZATIONS.map((o) => ({ orgId: o.id, plan: o.plan, period: 'annuelle', active: o.status !== 'Suspendu' })));

    // 2. Comptes : les profils scolaires sont rattachés à leur école ; agent/partenaire/admin à aucune.
    const schoolRoles = new Set(['eleve', 'parent', 'enseignant', 'etablissement']);
    const accounts = [...Object.values(DEMO_USERS), SECOND_SCHOOL_DIRECTOR];
    await tx.insert(t.users).values(accounts.map((u) => ({
      id: u.id, phone: u.phone, name: u.name, initials: u.initials, role: u.role, title: u.title, organization: u.organization ?? null,
      passwordHash: hash, activated: true, schoolId: u.id === SECOND_SCHOOL_DIRECTOR.id ? SECOND_SCHOOL_ID : schoolRoles.has(u.role) ? S : null,
    })));
    // Élèves et enseignants : chacun a un vrai compte (activé, mot de passe de démonstration), sauf celui d'un enseignant
    // dont l'invitation n'est pas encore activée (Rachel Nziengui : compte sans mot de passe) et ceux qui n'ont pas de téléphone.
    const knownIds = new Set(accounts.map((u) => u.id));
    const studentAccounts = [...STUDENTS.map((st) => ({ st, school: S })), ...SECOND_SCHOOL_DATA.students.map((st) => ({ st, school: SECOND_SCHOOL_ID }))]
      .filter(({ st }) => st.phone)
      .map(({ st, school }) => ({ id: st.id === 's1' ? STUDENT_ID : `u-${st.id}`, school, st }))
      .filter((a) => !knownIds.has(a.id));
    if (studentAccounts.length) {
      await tx.insert(t.users).values(studentAccounts.map(({ id, school, st }) => ({
        id, phone: normalizePhone(st.phone!), name: `${st.firstName} ${st.lastName}`, initials: initials(`${st.firstName} ${st.lastName}`),
        role: 'eleve', title: 'Élève', organization: null, passwordHash: hash, activated: true, schoolId: school,
      })));
    }
    const teacherAccounts = [...TEACHERS.map((x) => ({ ...x, school: S })), { ...SECOND_SCHOOL_DATA.teacher, school: SECOND_SCHOOL_ID }]
      .filter((x) => x.status !== 'Invitation expirée' && !knownIds.has(x.id === 't1' ? DEMO_USERS.enseignant.id : `u-${x.id}`) && x.id !== 't1');
    await tx.insert(t.users).values(teacherAccounts.map((x) => ({
      id: `u-${x.id}`, phone: normalizePhone(x.phone), name: x.name, initials: initials(x.name), role: 'enseignant', title: 'Enseignant', organization: null,
      passwordHash: x.status === 'Activé' ? hash : null, activated: x.status === 'Activé', schoolId: x.school,
    })));
    // Périmètre de l'agent : les six écoles de son tableau de bord.
    const agentScope = ['Lycée Léon Mba', 'Collège Bessieux', 'École Saint-Michel', 'Lycée d’Owendo', 'Collège de Nzeng-Ayong', 'École Akébé-Plaine'];
    await tx.insert(t.userScopes).values(ORGANIZATIONS.filter((o) => agentScope.includes(o.name)).map((o) => ({ userId: DEMO_USERS.agent.id, orgId: o.id })));

    // 3. Lycée Léon Mba : l'établissement de démonstration complet.
    await tx.insert(t.classes).values(CLASSES.map((c) => ({ id: c.id, schoolId: S, name: c.name, level: c.level, capacity: c.capacity, studentCount: c.students, completion: c.completion, alert: c.alert ?? null })));
    await tx.insert(t.students).values(STUDENTS.map((s) => ({ id: s.id, schoolId: S, firstName: s.firstName, lastName: s.lastName, classId: s.classId, userId: s.phone ? (s.id === 's1' ? STUDENT_ID : `u-${s.id}`) : null, phone: s.phone, code: s.code, activated: s.activated })));
    // Christelle Ondo (compte parent de démonstration) est la mère d'Aïcha ; Paul, son père, n'a pas d'application.
    const parents = STUDENTS.flatMap((s) => s.parents.map((p) => ({ studentId: s.id, name: p.name, relation: p.relation, parentUserId: p.name === DEMO_USERS.parent.name ? PARENT_ID : null })));
    if (parents.length) await tx.insert(t.studentParents).values(parents);
    await tx.insert(t.teachers).values(TEACHERS.map((x) => ({ id: x.id, name: x.name, phone: x.phone, status: x.status, schoolId: S, userId: x.id === 't1' ? DEMO_USERS.enseignant.id : x.status === 'Invitation expirée' ? null : `u-${x.id}` })));
    await tx.insert(t.linkRequests).values(LINK_REQUESTS.map((r) => ({ id: r.id, schoolId: S, parent: r.parent, relation: r.relation, child: r.child, meta: r.meta })));
    await tx.insert(t.schoolYears).values({ schoolId: S, label: SCHOOL_YEAR.label, start: SCHOOL_YEAR.start, end: SCHOOL_YEAR.end, active: SCHOOL_YEAR.active, terms: SCHOOL_YEAR.terms });
    await tx.insert(t.assignments).values(ASSIGNMENTS.map((a) => ({ ...a, schoolId: S })));
    await tx.insert(t.cases).values(CONFIDENTIAL_CASES.map((c) => ({ id: c.id, schoolId: S, reporter: c.reporter, className: c.className, type: c.type, received: c.received, student: c.student, text: c.text })));

    // Tâches de la 3ème B et avancement de chaque élève.
    await tx.insert(t.tasks).values(TASKS.map((k) => ({ id: k.id, schoolId: S, classId: '3b', teacherId: k.subject === 'Mathématiques' ? 't1' : null, title: k.title, description: k.id === 'k1' ? 'Simplifie chaque fraction, puis range-les de la plus petite à la plus grande. Écris le détail de tes calculs dans ton cahier.' : '', subject: k.subject, type: k.type, due: k.due, estimate: k.estimate, graded: k.type === 'Devoir' })));
    const done = (taskId: string, studentId: string, minutes: number, evaluation: string | null = null, proof = false) => ({ taskId, studentId, status: 'done', seconds: minutes * 60, evaluation, proof, points: 20, completedAt: new Date() });
    await tx.insert(t.taskCompletions).values([
      done('k3', 's1', 15), done('k6', 's1', 20), { taskId: 'k2', studentId: 's1', status: 'doing', seconds: 0, evaluation: null, proof: false, points: 0, completedAt: null },
    ]);
    // Suivi de « Fractions » (k1) : un état par élève de la 3ème B (Aïcha ne l'a pas encore commencée), dans l'ordre alphabétique des prénoms.
    const roster = ['s1', 's3', 's4', 's9', 's10', 's11', 's12', 's13'];
    const followIndex = [3, 0, 1, 2, 4, 5, 6, 7];
    const minutesOf = (txt: string) => parseInt(txt, 10) || 0;
    const k1Rows = roster.flatMap((studentId, i) => {
      const [status, time, ev, proof] = FOLLOW_UP[followIndex[i]!]!;
      if (status === 'none') return [];
      return [{ taskId: 'k1', studentId, status, seconds: minutesOf(time) * 60, evaluation: ev || null, proof, points: status === 'done' ? 20 : 0, completedAt: status === 'done' ? new Date() : null }];
    });
    if (k1Rows.length) await tx.insert(t.taskCompletions).values(k1Rows);
    await tx.insert(t.schoolSubjects).values(SUBJECT_GRADES.map((g) => ({ schoolId: S, name: g.subject, coefficient: g.coefficient })));
    // Évaluations de la 3ème B : les notes d'Aïcha ; le « Devoir surveillé » de maths a aussi des notes d'autres élèves.
    for (const g of SUBJECT_GRADES) {
      for (const n of g.notes) {
        const evalId = `ev-${slug(g.subject)}-${slug(n.label)}`;
        const [dateLabel, coefLabel] = n.meta.split(' · ');
        await tx.insert(t.evaluations).values({ id: evalId, schoolId: S, classId: '3b', subject: g.subject, trimester: 'T1', label: n.label, coefficient: parseInt(coefLabel!.replace(/\D/g, ''), 10) || 1, heldOn: isoOf(dateLabel!), teacherId: g.subject === 'Mathématiques' ? 't1' : null });
        await tx.insert(t.grades).values({ evaluationId: evalId, studentId: 's1', value: n.value, comment: n.comment });
        if (evalId === 'ev-mathematiques-devoir-surveille') await tx.insert(t.grades).values(DEVOIR_GRADES.map(([studentId, value]) => ({ evaluationId: evalId, studentId, value })));
      }
    }
    await tx.insert(t.learner).values({ userId: STUDENT_ID, points: STUDENT_START.points, streak: STUDENT_START.streak, doneToday: STUDENT_START.doneToday, history: [] });
    await tx.insert(t.rewards).values(REWARDS.map((r) => ({ ...r, ownerId: PARENT_ID })));
    await tx.insert(t.alertPrefs).values(ALERT_PREFS.map((a) => ({ ...a, userId: PARENT_ID })));
    await tx.insert(t.settings).values({ schoolId: S, key: 'referent', value: { name: 'Rosine Mba', confirmed: true } });

    const threadRows = (['eleve', 'parent', 'enseignant'] as const).flatMap((role) => THREADS[role].map((th) => ({ id: th.id, schoolId: S, role, initials: th.initials, name: th.name, kind: th.kind, last: th.last, time: th.time, unread: th.unread, icon: th.icon ?? null })));
    await tx.insert(t.threads).values(threadRows);
    // Conversation d'exemple : vue du parent (fil th1), de l'élève (th9) et de l'enseignant (th6).
    for (const [threadId, me, other] of [['th1', 'parent', 'enseignant'], ['th9', 'eleve', 'enseignant'], ['th6', 'enseignant', 'parent']] as const) {
      await tx.insert(t.messages).values(CONVERSATION.map((m, i) => ({ threadId, clientId: `seed-${threadId}-${i}`, senderRole: m.mine ? me : other, text: m.text, image: !!m.image, time: m.time })));
    }

    // 4. Collège Bessieux : un second établissement, distinct, pour montrer et tester le cloisonnement.
    const B = SECOND_SCHOOL_ID; const D = SECOND_SCHOOL_DATA;
    await tx.insert(t.classes).values(D.classes.map((c) => ({ id: c.id, schoolId: B, name: c.name, level: c.level, capacity: c.capacity, studentCount: c.students, completion: c.completion })));
    await tx.insert(t.students).values(D.students.map((s) => ({ id: s.id, schoolId: B, firstName: s.firstName, lastName: s.lastName, classId: s.classId, userId: `u-${s.id}`, phone: s.phone, code: s.code, activated: true })));
    await tx.insert(t.studentParents).values(D.students.flatMap((s) => s.parents.map(([name, relation]) => ({ studentId: s.id, name, relation }))));
    await tx.insert(t.teachers).values({ id: D.teacher.id, name: D.teacher.name, phone: D.teacher.phone, status: D.teacher.status, schoolId: B, userId: `u-${D.teacher.id}` });
    await tx.insert(t.attendanceRecords).values({ ...D.absence, schoolId: B });
    await tx.insert(t.announcements).values({ ...D.announcement, schoolId: B });
    await tx.insert(t.schoolYears).values({ schoolId: B, label: SCHOOL_YEAR.label, start: SCHOOL_YEAR.start, end: SCHOOL_YEAR.end, active: true, terms: SCHOOL_YEAR.terms });
    await tx.insert(t.cases).values({ id: D.case.id, schoolId: B, reporter: D.case.reporter, className: D.case.className, type: D.case.type, received: D.case.received, student: D.case.student, text: D.case.text });

    // 4 bis. École Saint-Michel : Junior, second enfant du parent de démonstration (autre établissement).
    await tx.insert(t.classes).values({ id: JUNIOR.klass.id, schoolId: THIRD_SCHOOL_ID, name: JUNIOR.klass.name, level: JUNIOR.klass.level, capacity: JUNIOR.klass.capacity, studentCount: JUNIOR.klass.students, completion: JUNIOR.klass.completion });
    await tx.insert(t.students).values({ ...JUNIOR.student, schoolId: THIRD_SCHOOL_ID, phone: null, activated: false });
    await tx.insert(t.studentParents).values({ studentId: JUNIOR.student.id, name: DEMO_USERS.parent.name, relation: 'mère', parentUserId: PARENT_ID });

    // Appels : tout vient de `attendance_records` (la page « Absences » de l'école en est une simple vue).
    const attendanceSchool = (classId: string) => (classId === JUNIOR.klass.id ? THIRD_SCHOOL_ID : S);
    await tx.insert(t.attendanceRecords).values(ATTENDANCE_SEED.map((a) => ({ ...a, schoolId: attendanceSchool(a.classId) })));
    // Temps de travail d'Aïcha sur les 7 derniers jours (une séance par jour).
    const day = 86_400_000;
    await tx.insert(t.workSessions).values(WEEK_MINUTES.map((w, i) => ({ userId: STUDENT_ID, seconds: w.minutes * 60, at: new Date(Date.now() - (6 - i) * day) })).filter((x) => x.seconds > 0));

    // 5. Administration et supervision (hors établissement).
    await tx.insert(t.institutionalUsers).values(AGENT_USERS.map((u) => ({ userId: u.name === DEMO_USERS.agent.name ? DEMO_USERS.agent.id : u.name === DEMO_USERS.partenaire.name ? DEMO_USERS.partenaire.id : null, name: u.name, role: u.role, scope: u.scope, status: u.status })));
    await tx.insert(t.incidents).values(TECH_INCIDENTS.map((i) => ({ id: i.id, icon: i.icon, title: i.title, when: i.when, tone: i.tone, status: i.status, meta: i.meta, description: i.description, table: i.table, action: i.action, actionIcon: i.actionIcon })));
    await tx.insert(t.visitReports).values(VISIT_REPORTS.map((v) => ({ schoolId: ORGANIZATIONS.find((o) => o.name === v.school)?.id ?? S, school: v.school, date: v.date, text: v.text })));
  });

  return true;
}
