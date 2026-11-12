import { and, eq } from 'drizzle-orm';
import type { Db } from './db.module.js';
import { settings } from './schema.js';

export interface ReferentSetting { name: string; confirmed: boolean }

const DEFAULTS = { referent: null as ReferentSetting | null };
type Settings = typeof DEFAULTS;

/** Réglages d'un établissement (référent vie scolaire…) : jamais partagés d'une école à l'autre. */
export async function getSetting<K extends keyof Settings>(db: Db, schoolId: string, key: K): Promise<Settings[K]> {
  const [row] = await db.select().from(settings).where(and(eq(settings.schoolId, schoolId), eq(settings.key, key)));
  return (row ? row.value : DEFAULTS[key]) as Settings[K];
}

export async function setSetting<K extends keyof Settings>(db: Db, schoolId: string, key: K, value: Settings[K]): Promise<void> {
  await db.insert(settings).values({ schoolId, key, value }).onConflictDoUpdate({ target: [settings.schoolId, settings.key], set: { value } });
}
