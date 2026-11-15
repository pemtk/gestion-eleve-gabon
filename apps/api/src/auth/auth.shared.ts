import type { Role, SessionUser } from '@sge/shared';
import type { users } from '../db/schema.js';

/** Ligne de la table des comptes. */
export type UserRow = typeof users.$inferSelect;

/** Compte tel qu'il est montré aux applications (jamais le mot de passe haché). */

export const toSessionUser = (u: UserRow): SessionUser => ({
  id: u.id,
  name: u.name,
  initials: u.initials,
  phone: u.phone,
  role: u.role as Role,
  title: u.title,
  organization: u.organization ?? undefined,
  schoolId: u.schoolId ?? undefined,
});

export const isProd = () => process.env.NODE_ENV === 'production';
