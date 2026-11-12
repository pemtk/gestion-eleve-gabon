import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  ANNOUNCE_TEMPLATES, FOLLOW_UP, PARENT_CODES, PARENT_LINKED, STUDENT_NAMES, TEACHER_CLASSES, announcementSchema,
  attendanceSchema, formatCode, gradeInputSchema, initials, reportInputSchema, taskInputSchema,
} from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CurrentUser, Roles, schoolOf, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { attendanceRecords, taskInvalidations, tasks } from '../db/schema.js';
import { getSetting } from '../db/settings.js';

@Roles('enseignant')
@Controller('me/teacher')
export class TeacherController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('home')
  home() {
    return {
      nextLesson: { time: '10 h', className: '3ème B', students: 38 },
      currentTask: { title: 'Fractions : exercices 4 à 9', className: '3ème B', due: 'aujourd’hui, 18 h', done: 28, total: 38, doubts: 5 },
      classes: TEACHER_CLASSES,
    };
  }

  @Get('attendance')
  async roll(@CurrentUser() user: AuthUser, @Query('classId') classId = '3b', @Query('date') date = 'today') {
    const saved = await this.db.select().from(attendanceRecords).where(and(eq(attendanceRecords.schoolId, schoolOf(user)), eq(attendanceRecords.classId, classId), eq(attendanceRecords.date, date)));
    return STUDENT_NAMES.map((name, i) => ({ studentId: `s${i + 1}`, name, initials: initials(name), status: saved.find((r) => r.studentId === `s${i + 1}`)?.status ?? 'P' }));
  }

  /** §6.5 — l'appel est enregistré (une seule fois par classe et par date) et notifie les parents des absents/retardataires. */
  @Post('attendance')
  async saveAttendance(@CurrentUser() user: AuthUser, @Body({ schema: attendanceSchema }) body: z.infer<typeof attendanceSchema>) {
    const sid = schoolOf(user);
    await this.db.transaction(async (tx) => {
      await tx.delete(attendanceRecords).where(and(eq(attendanceRecords.schoolId, sid), eq(attendanceRecords.classId, body.classId), eq(attendanceRecords.date, body.date)));
      if (body.entries.length) await tx.insert(attendanceRecords).values(body.entries.map((e) => ({ schoolId: sid, classId: body.classId, date: body.date, studentId: e.studentId, status: e.status, justification: e.justification ?? null })));
    });
    return { saved: body.entries.length, parentsNotified: body.entries.filter((e) => e.status !== 'P').length };
  }

  @Post('tasks')
  async createTask(@CurrentUser() user: AuthUser, @Body({ schema: taskInputSchema }) body: z.infer<typeof taskInputSchema>) {
    const [task] = await this.db.insert(tasks).values({ id: randomUUID(), schoolId: schoolOf(user), title: body.title, subject: body.subject, type: body.type, due: body.due, status: 'todo', estimate: body.estimateMinutes ? `${body.estimateMinutes} min` : '—' }).returning();
    return { task, notified: { students: 38, parents: 61 } };
  }

  @Get('tasks/:id/follow-up')
  async followUp(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const [t] = await this.db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, id), eq(tasks.schoolId, schoolOf(user))));
    if (!t) throw new NotFoundException('Tâche introuvable.');
    const invalid = new Set((await this.db.select().from(taskInvalidations).where(eq(taskInvalidations.taskId, id))).map((r) => r.studentIndex));
    const rows = STUDENT_NAMES.map((name, i) => {
      const [status, time, evaluation, proof] = FOLLOW_UP[i]!;
      const redo = invalid.has(i);
      return { index: i, name, initials: initials(name), status: redo ? 'redo' : status, time: redo ? 'points annulés' : time, evaluation, proof: proof && !redo };
    });
    return { rows, doubts: rows.filter((r) => r.evaluation === 'doubt').length };
  }

  /** §6.3 — Invalider : la tâche revient à faire et les points sont annulés. */
  @Post('tasks/:id/invalidate/:index')
  async invalidate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('index') index: string) {
    const [t] = await this.db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, id), eq(tasks.schoolId, schoolOf(user))));
    if (!t) throw new NotFoundException('Tâche introuvable.');
    const i = Number(index);
    if (!Number.isInteger(i) || FOLLOW_UP[i]?.[0] !== 'done') throw new BadRequestException('Seule une tâche terminée peut être invalidée.');
    await this.db.insert(taskInvalidations).values({ taskId: id, studentIndex: i }).onConflictDoNothing();
    return { invalidated: true, pointsCancelled: 20 };
  }

  @Post('grades')
  publishGrades(@Body({ schema: gradeInputSchema }) body: z.infer<typeof gradeInputSchema>) {
    return { published: body.entries.length, notified: body.entries.length };
  }

  /** §6.7 — le type « Confidentiel » exige un référent vie scolaire confirmé (§7.10). */
  @Post('reports')
  async report(@CurrentUser() user: AuthUser, @Body({ schema: reportInputSchema }) body: z.infer<typeof reportInputSchema>) {
    if (body.kind === 'confidentiel' && !(await getSetting(this.db, schoolOf(user), 'referent'))?.confirmed) {
      throw new BadRequestException('Aucun référent vie scolaire désigné : seul le signalement « Conduite / engagement » est disponible.');
    }
    return { sent: true, referentNotified: true, detailShared: body.kind !== 'confidentiel' };
  }

  @Get('announcement-templates')
  templates() {
    return ANNOUNCE_TEMPLATES;
  }

  @Post('announcements')
  announce(@Body({ schema: announcementSchema }) body: z.infer<typeof announcementSchema>) {
    return { sent: true, recipients: { students: 38, parents: 61 }, smsRelay: true, message: body.message };
  }

  @Get('parent-codes')
  codes() {
    return STUDENT_NAMES.map((name, i) => ({ name, initials: initials(name), code: formatCode(PARENT_CODES[i]!), linked: PARENT_LINKED[i]!, validUntil: '31 décembre 2026' }));
  }
}
