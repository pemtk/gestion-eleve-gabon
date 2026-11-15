import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { ANNOUNCE_TEMPLATES } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { announcements, studentParents, students } from '../../db/schema.js';
import { assertTeaches } from '../context.js';

const announceSchema = z.object({
  classId: z.string(),
  message: z.string().trim().min(1),
  attachment: z.string().optional(),
});

/** Annonces à une classe de l'enseignant (§6.6). */
@Roles('enseignant')
@Controller('me/teacher')
export class TeacherAnnouncementsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('announcement-templates')
  templates() {
    return ANNOUNCE_TEMPLATES;
  }

  /** Annonce à UNE classe de l'enseignant : conservée, avec le nombre réel d'élèves et de parents concernés. */
  @Post('announcements')
  async announce(
    @CurrentUser() user: AuthUser,
    @Body({ schema: announceSchema }) body: z.infer<typeof announceSchema>,
  ) {
    const sid = schoolOf(user);
    const cls = await assertTeaches(this.db, user, body.classId);
    const [{ parents }] = await this.db
      .select({ parents: count() })
      .from(studentParents)
      .innerJoin(students, eq(students.id, studentParents.studentId))
      .where(
        and(eq(students.schoolId, sid), eq(students.classId, body.classId)),
      );
    const [a] = await this.db
      .insert(announcements)
      .values({
        id: randomUUID(),
        schoolId: sid,
        title: '',
        message: body.message,
        audience: 'class',
        target: cls.className,
        authorId: user.sub,
        classId: body.classId,
      })
      .returning();
    return {
      sent: true,
      id: a!.id,
      recipients: { students: cls.students, parents },
      smsRelay: true,
      message: body.message,
    };
  }
}
