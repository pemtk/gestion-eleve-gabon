import { eq } from 'drizzle-orm';
import { initials, platformAdminSchema } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/password.js';
import type { Db } from './db.module.js';
import { users } from './schema.js';

/**
 * Crée le premier administrateur de la plateforme (compte activé, avec mot de passe).
 * Sert à la commande `npm run admin:create` et à l'amorçage au démarrage. Lève une erreur claire si les données
 * sont invalides ou si le numéro a déjà un compte.
 */
export async function createPlatformAdmin(db: Db, input: { name: string; phone: string; password: string }) {
  const parsed = platformAdminSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join('.') || 'valeur'} : ${i.message}`).join(' · '));
  const { name, phone, password } = parsed.data;
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (exists) throw new Error('Un compte existe déjà avec ce numéro.');
  const [admin] = await db.insert(users).values({
    id: `u-admin-${randomUUID()}`, phone, name, initials: initials(name), role: 'admin', title: 'Administrateur plateforme',
    passwordHash: hashPassword(password), activated: true, schoolId: null,
  }).returning();
  return admin!;
}

/**
 * Amorçage au démarrage : si `BOOTSTRAP_ADMIN_PHONE` et `BOOTSTRAP_ADMIN_PASSWORD` sont définis et qu'aucun administrateur
 * n'existe, il est créé. Sans effet ensuite. Une configuration invalide (mot de passe trop faible…) arrête le démarrage.
 */
export async function bootstrapAdmin(db: Db, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const phone = env.BOOTSTRAP_ADMIN_PHONE;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!phone || !password) return false;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1);
  if (existing) return false;
  await createPlatformAdmin(db, { name: env.BOOTSTRAP_ADMIN_NAME ?? 'Administrateur', phone, password });
  return true;
}
