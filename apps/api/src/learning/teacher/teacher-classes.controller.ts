import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { formatCode, initials } from '@sge/shared';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { studentParents, taskCompletions, tasks } from '../../db/schema.js';
import { assertTeaches, teacherClasses } from '../context.js';
import { TeacherRosterService } from './teacher-roster.service.js';

/** Classes de l'enseignant : liste, accueil, élèves et codes d'invitation des parents. */
@Roles('enseignant')
@Controller('me/teacher')
export class TeacherClassesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly roster: TeacherRosterService,
  ) {}

  @Get('classes')
  async classes(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const mine = await teacherClasses(this.db, user);
    return Promise.all(
      mine.classes.map(async (c) => ({
        id: c.classId,
        name: c.className,
        subject: c.subject,
        principal: c.principal,
        students: c.students,
        pct: await this.roster.completionRate(sid, c.classId, c.students),
      })),
    );
  }

  @Get('home')
  async home(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const mine = await teacherClasses(this.db, user);
    const classList = await Promise.all(
      mine.classes.map(async (c) => ({
        id: c.classId,
        name: c.className,
        subject: c.subject,
        principal: c.principal,
        students: c.students,
        pct: await this.roster.completionRate(sid, c.classId, c.students),
      })),
    );
    const [last] = mine.teacherId
      ? await this.db
          .select()
          .from(tasks)
          .where(
            and(eq(tasks.schoolId, sid), eq(tasks.teacherId, mine.teacherId)),
          )
          .orderBy(desc(tasks.position))
          .limit(1)
      : [];
    let currentTask = null;
    if (last) {
      const cls = mine.classes.find((c) => c.classId === last.classId);
      const rows = await this.db
        .select()
        .from(taskCompletions)
        .where(eq(taskCompletions.taskId, last.id));
      currentTask = {
        id: last.id,
        title: last.title,
        className: cls?.className ?? '',
        due: last.due,
        done: rows.filter((r) => r.status === 'done').length,
        total: cls?.students ?? 0,
        doubts: rows.filter(
          (r) => r.status === 'done' && r.evaluation === 'doubt',
        ).length,
      };
    }
    return {
      mainClass: classList.find((c) => c.principal) ?? classList[0] ?? null,
      currentTask,
      classes: classList,
    };
  }

  @Get('classes/:classId/students')
  async classStudents(
    @CurrentUser() user: AuthUser,
    @Param('classId') classId: string,
  ) {
    await assertTeaches(this.db, user, classId);
    return (await this.roster.roster(schoolOf(user), classId)).map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      initials: initials(`${s.firstName} ${s.lastName}`),
    }));
  }

  /** Codes d'invitation des parents d'une classe, avec le nombre de parents déjà rattachés (2 au plus). */
  @Get('parent-codes')
  async codes(
    @CurrentUser() user: AuthUser,
    @Query('classId') classId: string,
  ) {
    const sid = schoolOf(user);
    await assertTeaches(this.db, user, classId);
    const roster = await this.roster.roster(sid, classId);
    const links = roster.length
      ? await this.db
          .select({ studentId: studentParents.studentId, n: count() })
          .from(studentParents)
          .where(
            inArray(
              studentParents.studentId,
              roster.map((s) => s.id),
            ),
          )
          .groupBy(studentParents.studentId)
      : [];
    return roster.map((s) => ({
      studentId: s.id,
      name: `${s.firstName} ${s.lastName}`,
      initials: initials(`${s.firstName} ${s.lastName}`),
      code: formatCode(s.code),
      linked: links.find((l) => l.studentId === s.id)?.n ?? 0,
      validUntil: '31 décembre 2026',
    }));
  }
}
