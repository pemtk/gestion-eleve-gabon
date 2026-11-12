import { eq } from 'drizzle-orm';
import type { Plan } from '@sge/shared';
import type { Db } from './db.module.js';
import { settings } from './schema.js';

export interface SubscriptionSetting { plan: Plan; suspended: boolean; requestedPlan: Plan | null }
export interface ReferentSetting { name: string; confirmed: boolean }

const DEFAULTS = {
  subscription: { plan: 'Standard', suspended: false, requestedPlan: null } as SubscriptionSetting,
  referent: null as ReferentSetting | null,
  photoVisibility: 'school' as 'school' | 'teachers' | 'private',
};
type Settings = typeof DEFAULTS;

export async function getSetting<K extends keyof Settings>(db: Db, key: K): Promise<Settings[K]> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return (row ? row.value : DEFAULTS[key]) as Settings[K];
}

export async function setSetting<K extends keyof Settings>(db: Db, key: K, value: Settings[K]): Promise<void> {
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}
