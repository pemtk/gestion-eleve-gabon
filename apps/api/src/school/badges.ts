import { and, count, eq, isNull, lt, ne } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { attendanceRecords, cases, linkRequests } from '../db/schema.js';

export interface SchoolBadges {
  /** Demandes de rattachement parent en attente de décision. */
  users: number;
  /** Absences et retards sans justification. */
  absences: number;
  /** Signalements confidentiels non clos. */
  cases: number;
}

const total = async (query: Promise<{ n: number }[]>) =>
  (await query)[0]?.n ?? 0;

/** Compteurs de la barre latérale de l'école : propres à cet établissement, jamais figés. */
export async function schoolBadges(
  db: Db,
  schoolId: string,
): Promise<SchoolBadges> {
  const [users, absences, open] = await Promise.all([
    total(
      db
        .select({ n: count() })
        .from(linkRequests)
        .where(
          and(
            eq(linkRequests.schoolId, schoolId),
            isNull(linkRequests.decision),
          ),
        ),
    ),
    total(
      db
        .select({ n: count() })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.schoolId, schoolId),
            ne(attendanceRecords.status, 'P'),
            isNull(attendanceRecords.justification),
          ),
        ),
    ),
    total(
      db
        .select({ n: count() })
        .from(cases)
        .where(
          and(
            eq(cases.schoolId, schoolId),
            eq(cases.kind, 'confidentiel'),
            lt(cases.step, 5),
          ),
        ),
    ),
  ]);
  return { users, absences, cases: open };
}
