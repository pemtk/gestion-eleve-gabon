import { eq } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { learner } from '../db/schema.js';

/** Points et série d'un élève ; la ligne est créée à zéro pour un nouvel élève. */
export async function getLearner(db: Db, userId: string) {
  await db.insert(learner).values({ userId, points: 0, streak: 0, doneToday: 0, history: [] }).onConflictDoNothing();
  const [row] = await db.select().from(learner).where(eq(learner.userId, userId));
  return row!;
}
