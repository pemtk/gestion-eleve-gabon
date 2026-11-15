import {
  boolean,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
} from 'drizzle-orm/pg-core';
import { users } from './accounts.js';

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
  /** Province et niveau (écoles) : indicateurs par région du partenaire. */
  province: text('province'),
  level: text('level'),
});

export const orgSubscriptions = pgTable('org_subscriptions', {
  orgId: text('org_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull(),
  period: text('period').notNull().default('annuelle'),
  active: boolean('active').notNull().default(true),
  /** Formule demandée par l'établissement, en attente de validation. */
  requestedPlan: text('requested_plan'),
});

/** Périmètre d'un agent : les établissements dont il a la charge. */
export const userScopes = pgTable(
  'user_scopes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId] })],
);

export const institutionalUsers = pgTable('institutional_users', {
  id: serial('id').primaryKey(),
  /** Compte de l'agent ou du partenaire ; null pour les lignes historiques sans compte. */
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' })
    .unique(),
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
  schoolId: text('school_id')
    .notNull()
    .references(() => organizations.id),
  id: serial('id').primaryKey(),
  school: text('school').notNull(),
  date: text('date').notNull(),
  text: text('text').notNull(),
  visibleToSchool: boolean('visible_to_school').notNull().default(false),
  attachmentFileId: text('attachment_file_id'),
});
