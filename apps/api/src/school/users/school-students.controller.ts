import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { formatCode, initials, newStudentSchema } from '@sge/shared';
import { z } from 'zod';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { AccountsService } from '../../accounts/accounts.service.js';
import { classes, studentParents, students, users } from '../../db/schema.js';
import { SchoolPolicy } from '../school.policy.js';
import { code } from './school-users.shared.js';
import { StudentEnrollmentService } from './student-enrollment.service.js';

/** Élèves de l'école : liste, création manuelle, code parent et renvoi du SMS d'activation (§7.5). */
@Roles('etablissement')
@Controller('school')
export class SchoolStudentsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly policy: SchoolPolicy,
    private readonly accounts: AccountsService,
    private readonly enrollment: StudentEnrollmentService,
  ) {}

  @Get('students')
  async students(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const rows = await this.db
      .select({ s: students, className: classes.name })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(eq(students.schoolId, sid))
      .orderBy(students.lastName, students.firstName);
    const parents = await this.db
      .select({ p: studentParents })
      .from(studentParents)
      .innerJoin(students, eq(students.id, studentParents.studentId))
      .where(eq(students.schoolId, sid))
      .orderBy(studentParents.id);
    return rows.map(({ s, className }) => ({
      ...s,
      className,
      codeLabel: formatCode(s.code),
      initials: initials(`${s.firstName} ${s.lastName}`),
      parents: parents
        .filter(({ p }) => p.studentId === s.id)
        .map(({ p }) => ({ name: p.name, relation: p.relation })),
    }));
  }

  /** §7.5 — création manuelle : l'élève reçoit un SMS d'activation (formule Standard et plus). */
  @Post('students')
  async createStudent(
    @CurrentUser() user: AuthUser,
    @Body({ schema: newStudentSchema }) body: z.infer<typeof newStudentSchema>,
  ) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    const [cls] = await this.db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.id, body.classId), eq(classes.schoolId, sid)));
    if (!cls) throw new NotFoundException('Classe introuvable.');
    const sms = (await this.policy.features(sid)).sms;
    const student = await this.enrollment.insertStudent(sid, body, sms);
    return { student, smsSent: sms };
  }

  @Post('students/:id/regenerate-code')
  async regenerate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    await this.enrollment.student(id, sid);
    const next = code();
    await this.db
      .update(students)
      .set({ code: next })
      .where(and(eq(students.id, id), eq(students.schoolId, sid)));
    return { code: next, codeLabel: formatCode(next) };
  }

  @Post('students/:id/send-code')
  async sendCode(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const sid = schoolOf(user);
    await this.policy.require(sid, 'sms');
    const st = await this.enrollment.student(id, sid);
    const [account] = st.userId
      ? await this.db.select().from(users).where(eq(users.id, st.userId))
      : [];
    if (account && !account.activated) this.accounts.invite(account);
    return { sent: true };
  }
}
