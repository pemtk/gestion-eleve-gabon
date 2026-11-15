import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { gradeInputSchema } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { evaluations, grades } from '../../db/schema.js';
import { assertTeaches } from '../context.js';
import { todayIso } from './teacher.shared.js';
import { TeacherRosterService } from './teacher-roster.service.js';

/** Saisie et publication des notes d'une évaluation. */
@Roles('enseignant')
@Controller('me/teacher')
export class TeacherGradesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly roster: TeacherRosterService,
  ) {}

  /**
   * Publication des notes d'une évaluation (classe × matière × trimestre × libellé) : l'élève et le parent les voient aussitôt.
   * Rejouable : l'évaluation est unique, une note déjà publiée n'est jamais écrasée (la correction passe par l'école, avec motif).
   */
  @Post('grades')
  async publishGrades(
    @CurrentUser() user: AuthUser,
    @Body({ schema: gradeInputSchema }) body: z.infer<typeof gradeInputSchema>,
  ) {
    const sid = schoolOf(user);
    const mine = await assertTeaches(this.db, user, body.classId, body.subject);
    const ids = new Set(
      (await this.roster.roster(sid, body.classId)).map((s) => s.id),
    );
    if (!body.entries.length)
      throw new BadRequestException('Saisissez au moins une note.');
    if (body.entries.some((e) => !ids.has(e.studentId)))
      throw new BadRequestException(
        'Une note concerne un élève qui n’est pas dans cette classe.',
      );
    return this.db.transaction(async (tx) => {
      await tx
        .insert(evaluations)
        .values({
          id: randomUUID(),
          schoolId: sid,
          classId: body.classId,
          subject: body.subject,
          trimester: body.trimester,
          label: body.label,
          coefficient: body.coefficient,
          heldOn: todayIso(),
          teacherId: mine.teacherId,
        })
        .onConflictDoNothing();
      const [ev] = await tx
        .select()
        .from(evaluations)
        .where(
          and(
            eq(evaluations.classId, body.classId),
            eq(evaluations.subject, body.subject),
            eq(evaluations.trimester, body.trimester),
            eq(evaluations.label, body.label),
          ),
        );
      const inserted = await tx
        .insert(grades)
        .values(
          body.entries.map((e) => ({
            evaluationId: ev!.id,
            studentId: e.studentId,
            value: e.value,
            comment: e.comment,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: grades.id });
      return {
        evaluationId: ev!.id,
        published: inserted.length,
        alreadyPublished: body.entries.length - inserted.length,
        notified: inserted.length,
      };
    });
  }
}
