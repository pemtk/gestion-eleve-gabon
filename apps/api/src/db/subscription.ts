import { eq } from 'drizzle-orm';
import type { Plan } from '@sge/shared';
import type { Db } from './db.module.js';
import { organizations, orgSubscriptions } from './schema.js';

export interface Subscription { plan: Plan; suspended: boolean; requestedPlan: Plan | null }

/** Abonnement d'un établissement (une ligne par organisation). */
export async function getSubscription(db: Db, schoolId: string): Promise<Subscription> {
  const [row] = await db.select().from(orgSubscriptions).where(eq(orgSubscriptions.orgId, schoolId));
  if (!row) return { plan: 'Essentiel', suspended: true, requestedPlan: null };
  return { plan: row.plan as Plan, suspended: !row.active, requestedPlan: (row.requestedPlan as Plan | null) ?? null };
}

export async function setRequestedPlan(db: Db, schoolId: string, plan: Plan | null) {
  await db.update(orgSubscriptions).set({ requestedPlan: plan }).where(eq(orgSubscriptions.orgId, schoolId));
}

export async function schoolName(db: Db, schoolId: string): Promise<string> {
  const [o] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, schoolId));
  return o?.name ?? '';
}
