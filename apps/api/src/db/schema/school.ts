import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './platform.js';
import { users } from './accounts.js';

/* ============================== Établissement ============================== */
export const classes = pgTable(
  'classes',
  {
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    level: text('level').notNull(),
    capacity: integer('capacity').notNull(),
    /** Effectif affiché (les élèves non encore importés y sont comptés). */
    studentCount: integer('student_count').notNull().default(0),
    completion: integer('completion').notNull().default(0),
    alert: text('alert'),
  },
  (t) => [
    uniqueIndex('classes_school_name_uq').on(t.schoolId, t.name),
    unique('classes_id_school_uq').on(t.id, t.schoolId),
  ],
);

export const students = pgTable(
  'students',
  {
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    classId: text('class_id').notNull(),
    /** Compte de l'élève, une fois activé (ses points et son temps de travail y sont rattachés). */
    userId: text('user_id')
      .references(() => users.id)
      .unique(),
    phone: text('phone'),
    /** Code d'invitation parent (6 chiffres). */
    code: text('code').notNull().unique(),
    activated: boolean('activated').notNull().default(false),
    smsSent: boolean('sms_sent').notNull().default(false),
  },
  (t) => [
    index('students_school_idx').on(t.schoolId),
    // La classe d'un élève doit appartenir à la même école que l'élève (garantie assurée par la base).
    foreignKey({
      columns: [t.classId, t.schoolId],
      foreignColumns: [classes.id, classes.schoolId],
      name: 'students_class_same_school_fk',
    }),
  ],
);

export const studentParents = pgTable(
  'student_parents',
  {
    id: serial('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    relation: text('relation').notNull(),
    /** Compte du parent ; null tant que ce parent n'a pas d'application. */
    parentUserId: text('parent_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
  },
  (t) => [
    uniqueIndex('student_parents_student_user_uq').on(
      t.studentId,
      t.parentUserId,
    ),
  ],
);

export const teachers = pgTable(
  'teachers',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    /** Compte de l'enseignant, une fois activé. */
    userId: text('user_id')
      .references(() => users.id)
      .unique(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    status: text('status').notNull(),
  },
  (t) => [
    index('teachers_school_idx').on(t.schoolId),
    unique('teachers_id_school_uq').on(t.id, t.schoolId),
  ],
);

export const linkRequests = pgTable('link_requests', {
  schoolId: text('school_id')
    .notNull()
    .references(() => organizations.id),
  id: text('id').primaryKey(),
  parent: text('parent').notNull(),
  relation: text('relation').notNull(),
  child: text('child').notNull(),
  meta: text('meta').notNull(),
  /** Élève et compte parent concernés : à la validation par l'école, le rattachement est créé. */
  studentId: text('student_id'),
  parentUserId: text('parent_user_id'),
  decision: text('decision'),
});

export const schoolYears = pgTable('school_years', {
  schoolId: text('school_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  start: text('start').notNull(),
  end: text('end').notNull(),
  active: boolean('active').notNull().default(false),
  terms: jsonb('terms')
    .$type<
      { name: string; start: string; end: string; coefficient: number }[]
    >()
    .notNull(),
});

/** Affectation : un enseignant enseigne une matière dans une classe (de la même école, garanti par la base). */
export const assignments = pgTable(
  'assignments',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    teacherId: text('teacher_id').notNull(),
    classId: text('class_id').notNull(),
    subject: text('subject').notNull(),
    year: text('year').notNull(),
    principal: boolean('principal').notNull().default(false),
  },
  (t) => [
    uniqueIndex('assignments_teacher_class_subject_uq').on(
      t.teacherId,
      t.classId,
      t.subject,
    ),
    foreignKey({
      columns: [t.teacherId, t.schoolId],
      foreignColumns: [teachers.id, teachers.schoolId],
      name: 'assignments_teacher_same_school_fk',
    }),
    foreignKey({
      columns: [t.classId, t.schoolId],
      foreignColumns: [classes.id, classes.schoolId],
      name: 'assignments_class_same_school_fk',
    }),
  ],
);
