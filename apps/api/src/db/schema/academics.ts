import {
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './platform.js';
import { classes, students } from './school.js';

/** Évaluation (interrogation, devoir…) donnée à une classe dans une matière et un trimestre. */
export const evaluations = pgTable(
  'evaluations',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    classId: text('class_id').notNull(),
    subject: text('subject').notNull(),
    trimester: text('trimester').notNull(),
    label: text('label').notNull(),
    coefficient: integer('coefficient').notNull().default(1),
    /** Date de l'évaluation (ISO). */
    heldOn: text('held_on').notNull(),
    teacherId: text('teacher_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('evaluations_class_subject_term_label_uq').on(
      t.classId,
      t.subject,
      t.trimester,
      t.label,
    ),
    index('evaluations_school_idx').on(t.schoolId),
    foreignKey({
      columns: [t.classId, t.schoolId],
      foreignColumns: [classes.id, classes.schoolId],
      name: 'evaluations_class_same_school_fk',
    }),
  ],
);

/** Note d'un élève à une évaluation (publiée dès qu'elle existe ; corrigée par l'école avec motif). */
export const grades = pgTable(
  'grades',
  {
    id: serial('id').primaryKey(),
    evaluationId: text('evaluation_id')
      .notNull()
      .references(() => evaluations.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    value: real('value').notNull(),
    comment: text('comment').notNull().default(''),
  },
  (t) => [
    uniqueIndex('grades_evaluation_student_uq').on(t.evaluationId, t.studentId),
  ],
);

/** Coefficient de chaque matière dans la moyenne générale (propre à l'école). */
export const schoolSubjects = pgTable(
  'school_subjects',
  {
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    coefficient: integer('coefficient').notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.schoolId, t.name] })],
);

export const gradeCorrections = pgTable('grade_corrections', {
  id: serial('id').primaryKey(),
  gradeId: integer('grade_id')
    .notNull()
    .references(() => grades.id, { onDelete: 'cascade' }),
  fromValue: real('from_value').notNull(),
  toValue: real('to_value').notNull(),
  reason: text('reason').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});
