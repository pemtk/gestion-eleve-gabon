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
import { inviteSchema } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { AccountsService } from '../../accounts/accounts.service.js';
import { assignments, classes, teachers, users } from '../../db/schema.js';
import { SchoolPolicy } from '../school.policy.js';

/** Enseignants de l'école : liste, invitation par SMS et renvoi de l'invitation. */
@Roles('etablissement')
@Controller('school')
export class SchoolTeachersController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly policy: SchoolPolicy,
    private readonly accounts: AccountsService,
  ) {}

  /** Enseignants de l'école ; la colonne « Affectations » est calculée (« Maths · 3ème B, 4ème A »). */
  @Get('teachers')
  async teachers(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const [rows, aff] = await Promise.all([
      this.db
        .select()
        .from(teachers)
        .where(eq(teachers.schoolId, sid))
        .orderBy(teachers.id),
      this.db
        .select({ a: assignments, className: classes.name })
        .from(assignments)
        .innerJoin(classes, eq(classes.id, assignments.classId))
        .where(eq(assignments.schoolId, sid))
        .orderBy(classes.name),
    ]);
    return rows.map(({ userId: _u, ...t }) => {
      const bySubject = new Map<string, string[]>();
      for (const { a, className } of aff.filter(
        ({ a }) => a.teacherId === t.id,
      ))
        bySubject.set(a.subject, [
          ...(bySubject.get(a.subject) ?? []),
          className,
        ]);
      return {
        ...t,
        assignments: [...bySubject.entries()]
          .map(([subject, cls]) => `${subject} · ${cls.join(', ')}`)
          .join(' ; '),
      };
    });
  }

  @Post('teachers/invite')
  async invite(
    @CurrentUser() user: AuthUser,
    @Body({ schema: inviteSchema }) body: z.infer<typeof inviteSchema>,
  ) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    await this.policy.require(sid, 'sms');
    const { teacher, account } = await this.db.transaction(async (tx) => {
      const account = await this.accounts.create(
        {
          role: 'enseignant',
          name: body.name,
          phone: body.phone,
          schoolId: sid,
          title: 'Enseignant',
        },
        tx,
      );
      const [teacher] = await tx
        .insert(teachers)
        .values({
          id: randomUUID(),
          schoolId: sid,
          userId: account.id,
          name: body.name,
          phone: `+241 ${account.phone}`,
          status: 'Invitation envoyée',
        })
        .returning();
      return { teacher: teacher!, account };
    });
    this.accounts.invite(account);
    const { userId: _u, ...rest } = teacher;
    return { ...rest, assignments: '' };
  }

  @Post('teachers/:id/resend')
  async resend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    const [t] = await this.db
      .update(teachers)
      .set({ status: 'Invitation envoyée' })
      .where(and(eq(teachers.id, id), eq(teachers.schoolId, sid)))
      .returning();
    if (!t) throw new NotFoundException();
    const [account] = t.userId
      ? await this.db.select().from(users).where(eq(users.id, t.userId))
      : [];
    if (account && !account.activated) this.accounts.invite(account);
    const { userId: _u, ...rest } = t;
    return { ...rest, assignments: '' };
  }
}
