import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { and, desc, eq, ne } from 'drizzle-orm';
import { ATTENDANCE_STATUSES, JUSTIFICATIONS } from '@sge/shared';
import { z } from 'zod';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { attendanceRecords, classes, students } from '../../db/schema.js';
import { dateLabel } from '../../learning/results.js';
import { SchoolPolicy } from '../school.policy.js';

const absenceUpdate = z.object({
  status: z.enum(ATTENDANCE_STATUSES),
  justification: z.enum(JUSTIFICATIONS).nullable().optional(),
});

/** Absences et retards : vue de l'appel des enseignants, justification (§7.6). */
@Roles('etablissement')
@Controller('school')
export class SchoolAbsencesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly policy: SchoolPolicy,
  ) {}

  /** Absences et retards : vue de l'appel des enseignants (une seule source : `attendance_records`). */
  @Get('absences')
  async absences(@CurrentUser() user: AuthUser) {
    const rows = await this.db
      .select({
        r: attendanceRecords,
        firstName: students.firstName,
        lastName: students.lastName,
        className: classes.name,
      })
      .from(attendanceRecords)
      .innerJoin(students, eq(students.id, attendanceRecords.studentId))
      .innerJoin(classes, eq(classes.id, attendanceRecords.classId))
      .where(
        and(
          eq(attendanceRecords.schoolId, schoolOf(user)),
          ne(attendanceRecords.status, 'P'),
        ),
      )
      .orderBy(desc(attendanceRecords.date), attendanceRecords.id);
    return rows.map(({ r, firstName, lastName, className }) => ({
      id: String(r.id),
      studentId: r.studentId,
      student: `${firstName} ${lastName}`,
      className,
      date: r.date,
      dateLabel: dateLabel(r.date),
      status: r.status,
      justification: r.justification,
    }));
  }

  /** §7.7 — modifier un statut ou ajouter une justification. */
  @Patch('absences/:id')
  async updateAbsence(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: absenceUpdate }) body: z.infer<typeof absenceUpdate>,
  ) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    if (!/^\d+$/.test(id)) throw new NotFoundException();
    const set: Partial<typeof attendanceRecords.$inferInsert> = {
      status: body.status,
    };
    if (body.justification !== undefined)
      set.justification = body.justification;
    const [a] = await this.db
      .update(attendanceRecords)
      .set(set)
      .where(
        and(
          eq(attendanceRecords.id, Number(id)),
          eq(attendanceRecords.schoolId, sid),
        ),
      )
      .returning();
    if (!a) throw new NotFoundException();
    return {
      id: String(a.id),
      status: a.status,
      justification: a.justification,
    };
  }
}
