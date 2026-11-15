import {
  boolean,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { organizations } from './platform.js';

export const announcements = pgTable('announcements', {
  schoolId: text('school_id')
    .notNull()
    .references(() => organizations.id),
  id: text('id').primaryKey(),
  title: text('title').notNull().default(''),
  message: text('message').notNull(),
  audience: text('audience').notNull(),
  target: text('target'),
  /** Auteur (enseignant) et classe visée, le cas échéant. */
  authorId: text('author_id'),
  classId: text('class_id'),
  attachmentFileId: text('attachment_file_id'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

/** Signalements confidentiels et leur avancement (accusé → évaluation → plan d'action → clôture). */
/** Numérotation des dossiers : SC-0300, SC-0301… */
export const caseNumberSeq = pgSequence('case_number_seq', { startWith: 300 });

export const cases = pgTable(
  'cases',
  {
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').primaryKey(),
    reporter: text('reporter').notNull(),
    className: text('class_name').notNull(),
    type: text('type').notNull(),
    received: text('received').notNull(),
    student: text('student').notNull(),
    studentId: text('student_id'),
    reporterId: text('reporter_id'),
    /** « confidentiel » : traité par le référent ; « conduite » : visible de l'école. */
    kind: text('kind').notNull().default('confidentiel'),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    step: integer('step').notNull().default(1),
    gravity: text('gravity'),
    measures: text('measures').notNull().default(''),
    informDirector: boolean('inform_director').notNull().default(false),
    informFamily: boolean('inform_family').notNull().default(false),
    summary: text('summary'),
    actions: jsonb('actions')
      .$type<{ label: string; owner: string; due: string; done: boolean }[]>()
      .notNull()
      .default([]),
    log: jsonb('log')
      .$type<{ at: string; event: string }[]>()
      .notNull()
      .default([]),
  },
  (t) => [index('cases_school_idx').on(t.schoolId)],
);
