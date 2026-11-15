import {
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Post,
  Put,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { classInputSchema, pct, schoolYearSchema } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CurrentUser, Roles, schoolOf, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { isForeignKeyViolation, isUniqueViolation } from '../db/errors.js';
import { assignments, classes, schoolYears, teachers } from '../db/schema.js';
import { getSetting, setSetting } from '../db/settings.js';
import { IndicatorsService } from '../indicators/indicators.service.js';
import { SchoolPolicy } from './school.policy.js';

const photoSettingsSchema = z.object({ proofVisibleToParents: z.boolean() });

const assignmentSchema = z.object({
  teacherId: z.string().min(1),
  classId: z.string().min(1),
  subject: z.string().trim().min(1),
  year: z.string().min(1),
  principal: z.boolean().default(false),
});

@Roles('etablissement')
@Controller('school')
export class SchoolConfigController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly policy: SchoolPolicy,
    private readonly indicators: IndicatorsService,
  ) {}

  /** §11.3 — les photos de preuve sont vues de l'enseignant ; le parent ne les voit que si l'école l'autorise. */
  @Get('photo-settings')
  photoSettings(@CurrentUser() user: AuthUser) {
    return getSetting(this.db, schoolOf(user), 'photos');
  }

  @Put('photo-settings')
  async savePhotoSettings(
    @CurrentUser() user: AuthUser,
    @Body({ schema: photoSettingsSchema })
    body: z.infer<typeof photoSettingsSchema>,
  ) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    await setSetting(this.db, sid, 'photos', body);
    return body;
  }

  @Get('year')
  async year(@CurrentUser() user: AuthUser) {
    const [y] = await this.db
      .select()
      .from(schoolYears)
      .where(eq(schoolYears.schoolId, schoolOf(user)));
    return y ?? null;
  }

  /** §7.2 — le libellé, les dates et les trimestres (avec coefficients) ; l'année n'est visible qu'une fois activée. */
  @Put('year')
  async saveYear(
    @CurrentUser() user: AuthUser,
    @Body({ schema: schoolYearSchema }) body: z.infer<typeof schoolYearSchema>,
  ) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    const [y] = await this.db
      .insert(schoolYears)
      .values({ schoolId: sid, ...body, active: false })
      .onConflictDoUpdate({
        target: schoolYears.schoolId,
        set: { ...body, active: false },
      })
      .returning();
    return y;
  }

  @Post('year/activate')
  async activate(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    const [y] = await this.db
      .update(schoolYears)
      .set({ active: true })
      .where(eq(schoolYears.schoolId, sid))
      .returning();
    if (!y) throw new NotFoundException('Créez d’abord l’année scolaire.');
    return y;
  }

  @Get('classes')
  async classes(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const rows = await this.db
      .select()
      .from(classes)
      .where(eq(classes.schoolId, sid))
      .orderBy(classes.id);
    // La complétion est mesurée (tâches terminées sur 7 jours), pas la valeur figée de la démonstration ; null = rien à mesurer.
    const [stats] = await this.indicators.schools([sid], 7);
    const measured = new Map(
      (stats?.classes ?? []).map((c) => [c.id, pct(c.done, c.expected)]),
    );
    return rows.map(
      ({
        studentCount,
        schoolId: _s,
        completion: _stored,
        alert: _alert,
        ...c
      }) => ({
        ...c,
        students: studentCount,
        completion: measured.get(c.id) ?? null,
      }),
    );
  }

  @Post('classes')
  async createClass(
    @CurrentUser() user: AuthUser,
    @Body({ schema: classInputSchema }) body: z.infer<typeof classInputSchema>,
  ) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    try {
      const [c] = await this.db
        .insert(classes)
        .values({
          id: randomUUID(),
          schoolId: sid,
          name: body.name,
          level: body.level,
          capacity: body.capacity,
        })
        .returning();
      return { ...c, students: 0 };
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictException(
          'Une classe porte déjà ce nom dans votre établissement.',
        );
      throw e;
    }
  }

  /** Affectations de l'école, avec le nom de l'enseignant et de la classe. */
  @Get('assignments')
  async assignments(@CurrentUser() user: AuthUser) {
    const rows = await this.db
      .select({
        a: assignments,
        teacher: teachers.name,
        className: classes.name,
      })
      .from(assignments)
      .innerJoin(teachers, eq(teachers.id, assignments.teacherId))
      .innerJoin(classes, eq(classes.id, assignments.classId))
      .where(eq(assignments.schoolId, schoolOf(user)))
      .orderBy(assignments.id);
    return rows.map(({ a, teacher, className }) => ({
      id: a.id,
      teacherId: a.teacherId,
      classId: a.classId,
      teacher,
      className,
      subject: a.subject,
      year: a.year,
      principal: a.principal,
    }));
  }

  /** §7.6 — l'enseignant et la classe doivent appartenir à l'école (la base le garantit aussi). */
  @Post('assignments')
  async assign(
    @CurrentUser() user: AuthUser,
    @Body({ schema: assignmentSchema }) body: z.infer<typeof assignmentSchema>,
  ) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    try {
      const [a] = await this.db
        .insert(assignments)
        .values({ id: randomUUID(), schoolId: sid, ...body })
        .returning();
      return a;
    } catch (e) {
      if (isForeignKeyViolation(e))
        throw new NotFoundException(
          'Enseignant ou classe introuvable dans votre établissement.',
        );
      if (isUniqueViolation(e))
        throw new ConflictException(
          'Cet enseignant a déjà cette matière dans cette classe.',
        );
      throw e;
    }
  }
}
