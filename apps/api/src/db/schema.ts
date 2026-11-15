/**
 * Schéma de la base, regroupé par domaine (un fichier chacun) ; ce fichier les réunit pour le reste du code
 * (`import { users } from '../db/schema.js'`) et pour drizzle-kit (migrations).
 */
export * from './schema/accounts.js';
export * from './schema/school.js';
export * from './schema/learning.js';
export * from './schema/messaging.js';
export * from './schema/platform.js';
export * from './schema/academics.js';
export * from './schema/school-life.js';
