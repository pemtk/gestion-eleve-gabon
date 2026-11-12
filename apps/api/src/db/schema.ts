import { boolean, foreignKey, index, integer, jsonb, pgTable, primaryKey, real, serial, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core';

/* ============================== Comptes et sécurité ============================== */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  phone: text('phone').notNull().unique(),
  name: text('name').notNull(),
  initials: text('initials').notNull(),
  role: text('role').notNull(),
  title: text('title').notNull().default(''),
  organization: text('organization'),
  passwordHash: text('password_hash').notNull(),
  activated: boolean('activated').notNull().default(false),
  /** Établissement de rattachement (null pour agent, partenaire et administrateur : profils multi-établissements). */
  schoolId: text('school_id').references(() => organizations.id),
  photoVisibility: text('photo_visibility').notNull().default('school'),
}, (t) => [index('users_school_idx').on(t.schoolId)]);

export const otpCodes = pgTable('otp_codes', {
  phone: text('phone').primaryKey(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
});

/** Réglages clé/valeur : abonnement de l'école, référent vie scolaire, visibilité des photos. */
/** Réglages par établissement (référent vie scolaire…). */
export const settings = pgTable('settings', {
  schoolId: text('school_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
}, (t) => [primaryKey({ columns: [t.schoolId, t.key] })]);


/* ============================== Établissement ============================== */
export const classes = pgTable('classes', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  level: text('level').notNull(),
  capacity: integer('capacity').notNull(),
  /** Effectif affiché (les élèves non encore importés y sont comptés). */
  studentCount: integer('student_count').notNull().default(0),
  completion: integer('completion').notNull().default(0),
  alert: text('alert'),
}, (t) => [uniqueIndex('classes_school_name_uq').on(t.schoolId, t.name), unique('classes_id_school_uq').on(t.id, t.schoolId)]);

export const students = pgTable('students', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  classId: text('class_id').notNull(),
  phone: text('phone'),
  /** Code d'invitation parent (6 chiffres). */
  code: text('code').notNull().unique(),
  activated: boolean('activated').notNull().default(false),
  smsSent: boolean('sms_sent').notNull().default(false),
}, (t) => [
  index('students_school_idx').on(t.schoolId),
  // La classe d'un élève doit appartenir à la même école que l'élève (garantie assurée par la base).
  foreignKey({ columns: [t.classId, t.schoolId], foreignColumns: [classes.id, classes.schoolId], name: 'students_class_same_school_fk' }),
]);

export const studentParents = pgTable('student_parents', {
  id: serial('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  relation: text('relation').notNull(),
});

export const teachers = pgTable('teachers', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  assignments: text('assignments').notNull().default(''),
  status: text('status').notNull(),
}, (t) => [index('teachers_school_idx').on(t.schoolId)]);

export const linkRequests = pgTable('link_requests', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  id: text('id').primaryKey(),
  parent: text('parent').notNull(),
  relation: text('relation').notNull(),
  child: text('child').notNull(),
  meta: text('meta').notNull(),
  decision: text('decision'),
});

export const schoolYears = pgTable('school_years', {
  schoolId: text('school_id').primaryKey().references(() => organizations.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  start: text('start').notNull(),
  end: text('end').notNull(),
  active: boolean('active').notNull().default(false),
  terms: jsonb('terms').$type<{ name: string; start: string; end: string; coefficient: number }[]>().notNull(),
});


export const assignments = pgTable('assignments', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  id: text('id').primaryKey(),
  teacher: text('teacher').notNull(),
  className: text('class_name').notNull(),
  subject: text('subject').notNull(),
  year: text('year').notNull(),
  principal: boolean('principal').notNull().default(false),
});

export const absences = pgTable('absences', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  id: text('id').primaryKey(),
  student: text('student').notNull(),
  className: text('class_name').notNull(),
  date: text('date').notNull(),
  status: text('status').notNull(),
  justification: text('justification'),
}, (t) => [index('absences_school_idx').on(t.schoolId)]);

export const results = pgTable('results', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  id: text('id').primaryKey(),
  student: text('student').notNull(),
  value: real('value'),
  coefficient: integer('coefficient').notNull().default(1),
  comment: text('comment').notNull().default(''),
  published: boolean('published').notNull().default(false),
});

export const resultCorrections = pgTable('result_corrections', {
  id: serial('id').primaryKey(),
  resultId: text('result_id').notNull().references(() => results.id, { onDelete: 'cascade' }),
  fromValue: real('from_value').notNull(),
  toValue: real('to_value').notNull(),
  reason: text('reason').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

export const announcements = pgTable('announcements', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  id: text('id').primaryKey(),
  title: text('title').notNull().default(''),
  message: text('message').notNull(),
  audience: text('audience').notNull(),
  target: text('target'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

/** Signalements confidentiels et leur avancement (accusé → évaluation → plan d'action → clôture). */
export const cases = pgTable('cases', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  id: text('id').primaryKey(),
  reporter: text('reporter').notNull(),
  className: text('class_name').notNull(),
  type: text('type').notNull(),
  received: text('received').notNull(),
  student: text('student').notNull(),
  text: text('text').notNull(),
  step: integer('step').notNull().default(1),
  gravity: text('gravity'),
  measures: text('measures').notNull().default(''),
  informDirector: boolean('inform_director').notNull().default(false),
  informFamily: boolean('inform_family').notNull().default(false),
  summary: text('summary'),
  actions: jsonb('actions').$type<{ label: string; owner: string; due: string; done: boolean }[]>().notNull().default([]),
  log: jsonb('log').$type<{ at: string; event: string }[]>().notNull().default([]),
}, (t) => [index('cases_school_idx').on(t.schoolId)]);

/* ============================== Élève, parent, enseignant ============================== */
export const tasks = pgTable('tasks', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  type: text('type').notNull(),
  due: text('due').notNull(),
  status: text('status').notNull().default('todo'),
  estimate: text('estimate').notNull().default('—'),
  position: serial('position'),
}, (t) => [index('tasks_school_idx').on(t.schoolId)]);

export const taskInvalidations = pgTable('task_invalidations', {
  taskId: text('task_id').notNull(),
  studentIndex: integer('student_index').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.taskId, t.studentIndex] })]);

export const learner = pgTable('learner', {
  userId: text('user_id').primaryKey(),
  points: integer('points').notNull(),
  streak: integer('streak').notNull(),
  doneToday: integer('done_today').notNull(),
  history: jsonb('history').$type<{ label: string; when: string; points: string }[]>().notNull().default([]),
});

export const subjectGrades = pgTable('subject_grades', {
  id: serial('id').primaryKey(),
  /** Élève concerné. */
  userId: text('user_id').notNull(),
  subject: text('subject').notNull(),
  average: real('average').notNull(),
  coefficient: integer('coefficient').notNull(),
  notes: jsonb('notes').$type<{ label: string; value: number; meta: string; comment: string }[]>().notNull(),
});

export const rewards = pgTable('rewards', {
  id: text('id').primaryKey(),
  /** Parent qui offre la récompense. */
  ownerId: text('owner_id').notNull(),
  label: text('label').notNull(),
  threshold: integer('threshold').notNull(),
});

export const alertPrefs = pgTable('alert_prefs', {
  userId: text('user_id').notNull(),
  id: text('id').notNull(),
  label: text('label').notNull(),
  on: boolean('on').notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.id] })]);


export const attendanceRecords = pgTable('attendance_records', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  classId: text('class_id').notNull(),
  date: text('date').notNull(),
  studentId: text('student_id').notNull(),
  status: text('status').notNull(),
  justification: text('justification'),
}, (t) => [primaryKey({ columns: [t.classId, t.date, t.studentId] })]);

export const threads = pgTable('threads', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  id: text('id').primaryKey(),
  role: text('role').notNull(),
  initials: text('initials').notNull().default(''),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  last: text('last').notNull(),
  time: text('time').notNull(),
  unread: integer('unread').notNull().default(0),
  icon: text('icon'),
}, (t) => [index('threads_school_idx').on(t.schoolId, t.role)]);

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  threadId: text('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  /** Identifiant généré par l'appareil : rend l'envoi idempotent (file d'attente hors ligne). */
  clientId: text('client_id').notNull(),
  senderRole: text('sender_role').notNull(),
  text: text('text'),
  image: boolean('image').notNull().default(false),
  time: text('time').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('messages_thread_client_uq').on(t.threadId, t.clientId)]);

export const notificationReads = pgTable('notification_reads', {
  userId: text('user_id').notNull(),
  notificationId: text('notification_id').notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.notificationId] })]);


/* ============================== Agent, partenaire, administration ============================== */
/** Une organisation est une école, un diocèse ou un réseau ; une école est aussi le « tenant » de toutes les données scolaires. */
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  plan: text('plan').notNull(),
  status: text('status').notNull(),
  due: text('due').notNull().default(''),
  parentId: text('parent_id'),
});

export const orgSubscriptions = pgTable('org_subscriptions', {
  orgId: text('org_id').primaryKey().references(() => organizations.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull(),
  period: text('period').notNull().default('annuelle'),
  active: boolean('active').notNull().default(true),
  /** Formule demandée par l'établissement, en attente de validation. */
  requestedPlan: text('requested_plan'),
});

/** Périmètre d'un agent : les établissements dont il a la charge. */
export const userScopes = pgTable('user_scopes', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.userId, t.orgId] })]);

export const institutionalUsers = pgTable('institutional_users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  scope: text('scope').notNull(),
  status: text('status').notNull(),
});

export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(),
  icon: text('icon').notNull(),
  title: text('title').notNull(),
  when: text('when').notNull(),
  tone: text('tone').notNull(),
  status: text('status').notNull(),
  meta: text('meta').notNull(),
  description: text('description').notNull(),
  table: jsonb('table').$type<string[][]>().notNull(),
  action: text('action').notNull(),
  actionIcon: text('action_icon').notNull(),
});

export const visitReports = pgTable('visit_reports', {
  schoolId: text('school_id').notNull().references(() => organizations.id),
  id: serial('id').primaryKey(),
  school: text('school').notNull(),
  date: text('date').notNull(),
  text: text('text').notNull(),
  visibleToSchool: boolean('visible_to_school').notNull().default(false),
});
