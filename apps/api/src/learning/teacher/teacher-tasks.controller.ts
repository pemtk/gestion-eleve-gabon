import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { initials, taskInputSchema } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import {
  learner,
  studentParents,
  students,
  taskCompletions,
  tasks,
} from '../../db/schema.js';
import { assertTeaches, teacherClasses } from '../context.js';
import { TeacherRosterService } from './teacher-roster.service.js';

const POINTS_PER_TASK = 20;

/** Tâches publiées, suivi élève par élève et invalidation (§6.2, §6.3). */
@Roles('enseignant')
@Controller('me/teacher')
export class TeacherTasksController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly roster: TeacherRosterService,
  ) {}

  @Get('tasks')
  async myTasks(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const mine = await teacherClasses(this.db, user);
    if (!mine.teacherId) return [];
    const list = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.schoolId, sid), eq(tasks.teacherId, mine.teacherId)))
      .orderBy(desc(tasks.position));
    const done = list.length
      ? await this.db
          .select()
          .from(taskCompletions)
          .where(
            and(
              inArray(
                taskCompletions.taskId,
                list.map((t) => t.id),
              ),
              eq(taskCompletions.status, 'done'),
            ),
          )
      : [];
    return list.map((t) => {
      const c = mine.classes.find((x) => x.classId === t.classId);
      return {
        id: t.id,
        title: t.title,
        className: c?.className ?? '',
        due: t.due,
        done: done.filter((d) => d.taskId === t.id).length,
        total: c?.students ?? 0,
      };
    });
  }

  /** Publication d'une tâche pour UNE classe de l'enseignant ; sa matière est celle de l'affectation. */
  @Post('tasks')
  async createTask(
    @CurrentUser() user: AuthUser,
    @Body({ schema: taskInputSchema }) body: z.infer<typeof taskInputSchema>,
  ) {
    const sid = schoolOf(user);
    // La matière est celle de l'affectation (celle demandée si l'enseignant l'enseigne dans cette classe, sinon sa première).
    const all = await teacherClasses(this.db, user);
    const mine =
      all.classes.find(
        (c) => c.classId === body.classId && c.subject === body.subject,
      ) ?? all.classes.find((c) => c.classId === body.classId);
    if (!all.teacherId || !mine)
      throw new NotFoundException('Classe introuvable dans vos affectations.');
    const teacherId = all.teacherId;
    const [task] = await this.db
      .insert(tasks)
      .values({
        id: randomUUID(),
        schoolId: sid,
        classId: body.classId,
        teacherId,
        title: body.title,
        description: body.description,
        subject: mine.subject,
        type: body.type,
        due: body.due,
        estimate: body.estimateMinutes ? `${body.estimateMinutes} min` : '—',
        requirePhoto: body.requirePhoto,
        graded: body.graded,
      })
      .returning();
    const [{ parents }] = await this.db
      .select({ parents: count() })
      .from(studentParents)
      .innerJoin(students, eq(students.id, studentParents.studentId))
      .where(
        and(eq(students.schoolId, sid), eq(students.classId, body.classId)),
      );
    return { task, notified: { students: mine.students, parents } };
  }

  /** Une ligne par élève de la classe : pas commencé, en cours, terminé (avec temps, auto-évaluation, preuve) ou à refaire. */
  @Get('tasks/:id/follow-up')
  async followUp(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const sid = schoolOf(user);
    const [t] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.schoolId, sid)));
    if (!t) throw new NotFoundException('Tâche introuvable.');
    const cls = await assertTeaches(this.db, user, t.classId);
    const done = await this.db
      .select()
      .from(taskCompletions)
      .where(eq(taskCompletions.taskId, id));
    const rows = (await this.roster.roster(sid, t.classId)).map((s) => {
      const c = done.find((x) => x.studentId === s.id);
      const status =
        c?.status === 'done' || c?.status === 'doing' || c?.status === 'redo'
          ? c.status
          : 'none';
      const time =
        status === 'redo'
          ? 'points annulés'
          : status === 'none' || !c?.seconds
            ? '—'
            : `${Math.max(1, Math.round(c.seconds / 60))} min`;
      return {
        studentId: s.id,
        name: `${s.firstName} ${s.lastName}`,
        initials: initials(`${s.firstName} ${s.lastName}`),
        status,
        time,
        evaluation: status === 'done' ? (c?.evaluation ?? '') : '',
        proof: status === 'done' && !!c?.proof,
        proofFileId: status === 'done' ? (c?.proofFileId ?? null) : null,
      };
    });
    return {
      task: { id: t.id, title: t.title, due: t.due, className: cls.className },
      rows,
      doubts: rows.filter((r) => r.evaluation === 'doubt').length,
    };
  }

  /** §6.3 — Invalider : la tâche revient à faire pour cet élève et les points sont annulés. */
  @Post('tasks/:id/invalidate/:studentId')
  async invalidate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    const sid = schoolOf(user);
    const [t] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.schoolId, sid)));
    if (!t) throw new NotFoundException('Tâche introuvable.');
    await assertTeaches(this.db, user, t.classId);
    return this.db.transaction(async (tx) => {
      const [c] = await tx
        .select()
        .from(taskCompletions)
        .where(
          and(
            eq(taskCompletions.taskId, id),
            eq(taskCompletions.studentId, studentId),
          ),
        )
        .for('update');
      if (!c)
        throw new NotFoundException('Cet élève n’a pas commencé cette tâche.');
      if (c.status !== 'done')
        throw new BadRequestException(
          'Seule une tâche terminée peut être invalidée.',
        );
      await tx
        .update(taskCompletions)
        .set({ status: 'redo', points: 0, invalidatedAt: new Date() })
        .where(
          and(
            eq(taskCompletions.taskId, id),
            eq(taskCompletions.studentId, studentId),
          ),
        );
      const [s] = await tx
        .select({ userId: students.userId })
        .from(students)
        .where(eq(students.id, studentId));
      if (s?.userId && c.points)
        await tx
          .update(learner)
          .set({ points: sql`greatest(${learner.points} - ${c.points}, 0)` })
          .where(eq(learner.userId, s.userId));
      return {
        invalidated: true,
        pointsCancelled: c.points || POINTS_PER_TASK,
      };
    });
  }
}
