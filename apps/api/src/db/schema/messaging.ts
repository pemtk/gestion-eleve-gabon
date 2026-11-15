import {
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './platform.js';
import { users } from './accounts.js';

/* ============================== Messagerie ============================== */
/**
 * Une conversation : privée (deux personnes, ou un parent et l'administration de l'école), de classe (élèves ou parents) ou d'école (équipe).
 * Les droits ne sont jamais lus dans l'URL : ils se déduisent de l'appartenance (membres explicites pour le privé, classe et école pour les groupes).
 */
export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    /** private | class | school */
    kind: text('kind').notNull(),
    /** class : « students » ou « parents » ; private : « administration » pour un parent qui écrit à la direction. */
    audience: text('audience'),
    classId: text('class_id'),
    /** Une seule conversation par couple de personnes, par classe et audience, ou par école : la création est idempotente. */
    uniqueKey: text('unique_key').notNull().unique(),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  },
  (t) => [index('conversations_school_idx').on(t.schoolId, t.kind)],
);

/** Participants explicites : conversations privées uniquement (les groupes se déduisent de la classe ou de l'école). */
export const conversationMembers = pgTable(
  'conversation_members',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index('conversation_members_user_idx').on(t.userId),
  ],
);

/** Dernier message lu par chaque participant : les non-lus sont les messages des autres après ce curseur. */
export const conversationReads = pgTable(
  'conversation_reads',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastReadMessageId: integer('last_read_message_id').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] })],
);

export const conversationMessages = pgTable(
  'conversation_messages',
  {
    id: serial('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    /** Identifiant généré par l'appareil : rend l'envoi idempotent (file d'attente hors ligne). */
    clientId: text('client_id').notNull(),
    senderId: text('sender_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    senderRole: text('sender_role').notNull(),
    text: text('text'),
    /** Image jointe (table `files`, usage « message »). */
    fileId: text('file_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('conversation_messages_client_uq').on(
      t.conversationId,
      t.clientId,
    ),
    index('conversation_messages_conv_idx').on(t.conversationId, t.id),
  ],
);

export const notificationReads = pgTable(
  'notification_reads',
  {
    userId: text('user_id').notNull(),
    notificationId: text('notification_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.notificationId] })],
);
