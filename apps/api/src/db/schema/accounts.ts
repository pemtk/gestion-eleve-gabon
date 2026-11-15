import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { organizations } from './platform.js';

/* ============================== Comptes et sécurité ============================== */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    phone: text('phone').notNull().unique(),
    name: text('name').notNull(),
    initials: text('initials').notNull(),
    role: text('role').notNull(),
    title: text('title').notNull().default(''),
    organization: text('organization'),
    /** Null tant que le titulaire n'a pas défini de mot de passe (compte créé par l'école, activé par code SMS). */
    passwordHash: text('password_hash'),
    activated: boolean('activated').notNull().default(false),
    /** Établissement de rattachement (null pour agent, partenaire et administrateur : profils multi-établissements). */
    schoolId: text('school_id').references(() => organizations.id),
    photoVisibility: text('photo_visibility').notNull().default('school'),
    /** Photo de profil (table `files`) ; sa visibilité suit `photoVisibility`. */
    avatarFileId: text('avatar_file_id'),
  },
  (t) => [index('users_school_idx').on(t.schoolId)],
);

export const otpCodes = pgTable('otp_codes', {
  phone: text('phone').primaryKey(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
});

/** Compteurs de limitation de débit (connexion, codes SMS) : en base pour rester valables avec plusieurs instances. */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true })
    .notNull()
    .defaultNow(),
  blockedUntil: timestamp('blocked_until', { withTimezone: true }),
});

/**
 * Jetons de renouvellement (opaques, stockés hachés). Chaque renouvellement remplace le précédent ; la réutilisation d'un jeton
 * déjà remplacé révoque toute la famille (vol probable). Une famille expire au bout de 30 jours quoi qu'il arrive.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: text('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    familyStartedAt: timestamp('family_started_at', {
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedBy: text('replaced_by'),
  },
  (t) => [
    index('refresh_tokens_user_idx').on(t.userId),
    index('refresh_tokens_family_idx').on(t.familyId),
  ],
);

/** Journal d'audit : accès et actions sensibles (signalements confidentiels, sécurité des comptes). Jamais modifié ni purgé par l'application. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    schoolId: text('school_id'),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    /** « ok » ou « refuse » (ressource introuvable ou d'une autre école, droits insuffisants). */
    outcome: text('outcome').notNull().default('ok'),
    ip: text('ip'),
    details: jsonb('details'),
  },
  (t) => [
    index('audit_log_school_idx').on(t.schoolId, t.at),
    index('audit_log_resource_idx').on(t.resourceType, t.resourceId),
  ],
);

/**
 * Fichiers téléversés (octets dans le stockage objet, métadonnées ici). Un fichier est « pending » jusqu'à ce qu'un objet le réclame
 * (preuve d'une tâche, annonce, compte-rendu, photo de profil, message) : les orphelins sont purgés. L'accès se décide à la lecture,
 * d'après l'objet auquel il est rattaché (`ref_type`, `ref_id`), jamais d'après une URL devinable.
 */
export const files = pgTable(
  'files',
  {
    id: text('id').primaryKey(),
    /** Établissement du fichier ; null pour un compte sans école (parent, administrateur) tant qu'il n'est rattaché à aucune. */
    schoolId: text('school_id').references(() => organizations.id),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    status: text('status').notNull().default('pending'),
    refType: text('ref_type'),
    refId: text('ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('files_owner_idx').on(t.ownerId),
    index('files_school_idx').on(t.schoolId),
    index('files_pending_idx').on(t.status, t.createdAt),
  ],
);

/** Réglages clé/valeur : abonnement de l'école, référent vie scolaire, visibilité des photos. */
/** Réglages par établissement (référent vie scolaire…). */
export const settings = pgTable(
  'settings',
  {
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.schoolId, t.key] })],
);
