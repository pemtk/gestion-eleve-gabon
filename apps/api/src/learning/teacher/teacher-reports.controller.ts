import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { reportInputSchema } from '@sge/shared';
import { z } from 'zod';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { cases, classes, students } from '../../db/schema.js';
import { getSetting } from '../../db/settings.js';
import { assertTeaches } from '../context.js';

/** Signalements d'un élève (§6.7) : conduite ou confidentiel. */
@Roles('enseignant')
@Controller('me/teacher')
export class TeacherReportsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * §6.7 — signalement d'un élève de ses classes. « Confidentiel » exige un référent confirmé (§7.10) et crée un dossier
   * traité par le référent ; « conduite » est visible de l'école.
   */
  @Post('reports')
  async report(
    @CurrentUser() user: AuthUser,
    @Body({ schema: reportInputSchema })
    body: z.infer<typeof reportInputSchema>,
  ) {
    const sid = schoolOf(user);
    const [s] = await this.db
      .select({ s: students, className: classes.name })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(eq(students.id, body.studentId), eq(students.schoolId, sid)));
    if (!s) throw new NotFoundException('Élève introuvable.');
    await assertTeaches(this.db, user, s.s.classId);
    if (
      body.kind === 'confidentiel' &&
      !(await getSetting(this.db, sid, 'referent'))?.confirmed
    ) {
      throw new BadRequestException(
        'Aucun référent vie scolaire désigné : seul le signalement « Conduite / engagement » est disponible.',
      );
    }
    const confidential = body.kind === 'confidentiel';
    const seq = await this.db.execute(
      sql`select nextval('case_number_seq') as n`,
    );
    const id = `SC-${String((seq.rows[0] as { n: string }).n).padStart(4, '0')}`;
    const at = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    await this.db.insert(cases).values({
      id,
      schoolId: sid,
      reporter: `Enseignant · ${user.name}`,
      reporterId: user.sub,
      className: s.className,
      type: confidential ? 'Confidentiel' : 'Conduite / engagement',
      kind: body.kind,
      received: 'à l’instant',
      student: `${s.s.firstName} ${s.s.lastName}`,
      studentId: s.s.id,
      text: body.description,
      log: [{ at, event: 'Signalement reçu' }],
    });
    return {
      sent: true,
      caseId: id,
      referentNotified: confidential,
      detailShared: !confidential,
    };
  }
}
