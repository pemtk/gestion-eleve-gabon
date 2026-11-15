import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './platform.js';
import { classes, students } from './school.js';

/* ============================== Élève, parent, enseignant ============================== */
export const tasks = pgTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    /** Classe destinataire : seuls ses élèves voient la tâche. */
    classId: text('class_id').notNull(),
    teacherId: text('teacher_id'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    subject: text('subject').notNull(),
    type: text('type').notNull(),
    due: text('due').notNull(),
    estimate: text('estimate').notNull().default('—'),
    requirePhoto: boolean('require_photo').notNull().default(false),
    graded: boolean('graded').notNull().default(false),
    position: serial('position'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('tasks_school_idx').on(t.schoolId),
    index('tasks_class_idx').on(t.classId),
    foreignKey({
      columns: [t.classId, t.schoolId],
      foreignColumns: [classes.id, classes.schoolId],
      name: 'tasks_class_same_school_fk',
    }),
  ],
);

/** Avancement d'un élève sur une tâche : « doing », « done » ou « redo » (invalidée par l'enseignant). */
export const taskCompletions = pgTable(
  'task_completions',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    seconds: integer('seconds').notNull().default(0),
    evaluation: text('evaluation'),
    proof: boolean('proof').notNull().default(false),
    /** Photo de preuve (table `files`), visible de l'enseignant de la classe et, selon le réglage de l'école, du parent. */
    proofFileId: text('proof_file_id'),
    /** Points accordés à la validation ; annulés si l'enseignant invalide. */
    points: integer('points').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.studentId] })],
);

export const learner = pgTable('learner', {
  userId: text('user_id').primaryKey(),
  points: integer('points').notNull(),
  streak: integer('streak').notNull(),
  doneToday: integer('done_today').notNull(),
  history: jsonb('history')
    .$type<{ label: string; when: string; points: string }[]>()
    .notNull()
    .default([]),
});

/** Temps de travail réel d'un élève (secondes chronométrées sur une tâche terminée). */
export const workSessions = pgTable(
  'work_sessions',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    seconds: integer('seconds').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('work_sessions_user_idx').on(t.userId, t.at)],
);

export const rewards = pgTable('rewards', {
  id: text('id').primaryKey(),
  /** Parent qui offre la récompense. */
  ownerId: text('owner_id').notNull(),
  label: text('label').notNull(),
  threshold: integer('threshold').notNull(),
});

export const alertPrefs = pgTable(
  'alert_prefs',
  {
    userId: text('user_id').notNull(),
    id: text('id').notNull(),
    label: text('label').notNull(),
    on: boolean('on').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

/** Appel : une ligne par élève, classe et jour. Source unique des absences et retards (vue de l'école comprise). */
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: serial('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    classId: text('class_id').notNull(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    /** Jour de l'appel, au format ISO (AAAA-MM-JJ). */
    date: text('date').notNull(),
    /** P présent, A absent, R en retard. */
    status: text('status').notNull(),
    justification: text('justification'),
    takenBy: text('taken_by'),
  },
  (t) => [
    uniqueIndex('attendance_class_date_student_uq').on(
      t.classId,
      t.date,
      t.studentId,
    ),
    index('attendance_school_date_idx').on(t.schoolId, t.date),
    foreignKey({
      columns: [t.classId, t.schoolId],
      foreignColumns: [classes.id, classes.schoolId],
      name: 'attendance_class_same_school_fk',
    }),
  ],
);
