import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { attendanceSchema, initials } from '@sge/shared';
import { z } from 'zod';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { attendanceRecords } from '../../db/schema.js';
import { assertTeaches } from '../context.js';
import { todayIso } from './teacher.shared.js';
import { TeacherRosterService } from './teacher-roster.service.js';

/** Appel de la classe (§6.5) : lecture et enregistrement. */
@Roles('enseignant')
@Controller('me/teacher')
export class TeacherAttendanceController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly roster: TeacherRosterService,
  ) {}

  /** Appel d'un jour : un élève sans ligne est « présent » par défaut. */
  @Get('attendance')
  async roll(
    @CurrentUser() user: AuthUser,
    @Query('classId') classId: string,
    @Query('date') date = todayIso(),
  ) {
    if (!classId) throw new BadRequestException('Choisissez une classe.');
    const sid = schoolOf(user);
    await assertTeaches(this.db, user, classId);
    const saved = await this.db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.schoolId, sid),
          eq(attendanceRecords.classId, classId),
          eq(attendanceRecords.date, date),
        ),
      );
    return (await this.roster.roster(sid, classId)).map((s) => {
      const r = saved.find((x) => x.studentId === s.id);
      return {
        studentId: s.id,
        name: `${s.firstName} ${s.lastName}`,
        initials: initials(`${s.firstName} ${s.lastName}`),
        status: r?.status ?? 'P',
        justification: r?.justification ?? null,
      };
    });
  }

  /** §6.5 — enregistre l'appel (rejouable : une ligne par classe, jour et élève). Les parents des absents/retardataires sont à prévenir. */
  @Post('attendance')
  async saveAttendance(
    @CurrentUser() user: AuthUser,
    @Body({ schema: attendanceSchema }) body: z.infer<typeof attendanceSchema>,
  ) {
    const sid = schoolOf(user);
    await assertTeaches(this.db, user, body.classId);
    const ids = new Set(
      (await this.roster.roster(sid, body.classId)).map((s) => s.id),
    );
    if (body.entries.some((e) => !ids.has(e.studentId)))
      throw new BadRequestException(
        'Un élève de l’appel n’appartient pas à cette classe.',
      );
    if (body.entries.length) {
      await this.db
        .insert(attendanceRecords)
        .values(
          body.entries.map((e) => ({
            schoolId: sid,
            classId: body.classId,
            studentId: e.studentId,
            date: body.date,
            status: e.status,
            justification: e.status === 'P' ? null : (e.justification ?? null),
            takenBy: user.sub,
          })),
        )
        .onConflictDoUpdate({
          target: [
            attendanceRecords.classId,
            attendanceRecords.date,
            attendanceRecords.studentId,
          ],
          set: {
            status: sql`excluded.status`,
            justification: sql`excluded.justification`,
            takenBy: sql`excluded.taken_by`,
          },
        });
    }
    return {
      saved: body.entries.length,
      parentsNotified: body.entries.filter((e) => e.status !== 'P').length,
    };
  }
}
