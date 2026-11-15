import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { gradeCorrectionSchema } from '@sge/shared';
import { z } from 'zod';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import {
  classes,
  evaluations,
  gradeCorrections,
  grades,
  students,
} from '../../db/schema.js';
import { SchoolPolicy } from '../school.policy.js';

const TERMS: Record<string, string> = {
  T1: '1er trimestre',
  T2: '2ème trimestre',
  T3: '3ème trimestre',
};

/** Résultats de l'école et corrections de notes publiées, avec motif (§7.7). */
@Roles('etablissement')
@Controller('school')
export class SchoolResultsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly policy: SchoolPolicy,
  ) {}

  /**
   * Résultats d'une évaluation (la plus récente par défaut, ou `?evaluation=`) : une ligne par élève de la classe,
   * « non saisie » pour ceux qui n'ont pas de note.
   */
  @Get('results')
  async results(
    @CurrentUser() user: AuthUser,
    @Query('evaluation') evaluationId?: string,
  ) {
    const sid = schoolOf(user);
    const all = await this.db
      .select({ e: evaluations, className: classes.name })
      .from(evaluations)
      .innerJoin(classes, eq(classes.id, evaluations.classId))
      .where(eq(evaluations.schoolId, sid))
      .orderBy(desc(evaluations.heldOn), desc(evaluations.createdAt));
    const list = all.map(({ e, className }) => ({
      id: e.id,
      label: e.label,
      subject: e.subject,
      trimester: e.trimester,
      className,
    }));
    const picked = all.find(({ e }) => e.id === evaluationId) ?? all[0];
    if (!picked)
      return {
        evaluations: list,
        evaluationId: null,
        className: '',
        subject: '',
        term: '',
        evaluation: '',
        average: null,
        rows: [],
      };
    const { e, className } = picked;
    const roster = await this.db
      .select()
      .from(students)
      .where(and(eq(students.schoolId, sid), eq(students.classId, e.classId)))
      .orderBy(students.firstName, students.lastName);
    const given = await this.db
      .select()
      .from(grades)
      .where(eq(grades.evaluationId, e.id));
    const corrections = given.length
      ? await this.db
          .select()
          .from(gradeCorrections)
          .where(
            inArray(
              gradeCorrections.gradeId,
              given.map((g) => g.id),
            ),
          )
          .orderBy(gradeCorrections.id)
      : [];
    const values = given.map((g) => g.value);
    return {
      evaluations: list,
      evaluationId: e.id,
      className,
      subject: e.subject,
      term: TERMS[e.trimester] ?? e.trimester,
      evaluation: e.label,
      average: values.length
        ? values.reduce((x, y) => x + y, 0) / values.length
        : null,
      rows: roster.map((st) => {
        const g = given.find((x) => x.studentId === st.id);
        return {
          id: g ? String(g.id) : null,
          student: `${st.firstName} ${st.lastName}`,
          value: g?.value ?? null,
          coefficient: e.coefficient,
          published: !!g,
          history: corrections
            .filter((c) => c.gradeId === g?.id)
            .map((c) => ({
              from: c.fromValue,
              to: c.toValue,
              reason: c.reason,
              at: c.at,
            })),
        };
      }),
    };
  }

  /** §7.8 — corriger une note publiée : nouvelle valeur et motif obligatoire (historisés), visible tout de suite. */
  @Post('results/:id/correct')
  async correct(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: gradeCorrectionSchema })
    body: z.infer<typeof gradeCorrectionSchema>,
  ) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    if (!/^\d+$/.test(id)) throw new NotFoundException();
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ g: grades })
        .from(grades)
        .innerJoin(evaluations, eq(evaluations.id, grades.evaluationId))
        .where(and(eq(grades.id, Number(id)), eq(evaluations.schoolId, sid)))
        .for('update', { of: grades });
      if (!row) throw new NotFoundException();
      await tx.insert(gradeCorrections).values({
        gradeId: row.g.id,
        fromValue: row.g.value,
        toValue: body.value,
        reason: body.reason,
      });
      const [updated] = await tx
        .update(grades)
        .set({ value: body.value })
        .where(eq(grades.id, row.g.id))
        .returning();
      return { id: String(updated!.id), value: updated!.value };
    });
  }
}
