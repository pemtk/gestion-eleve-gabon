import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import {
  ANNOUNCE_TEMPLATES, FOLLOW_UP, PARENT_CODES, PARENT_LINKED, STUDENT_NAMES, TEACHER_CLASSES, announcementSchema,
  attendanceSchema, formatCode, gradeInputSchema, initials, reportInputSchema, taskInputSchema,
} from '@sge/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { StoreService } from '../common/store.service.js';

@Roles('enseignant')
@Controller('me/teacher')
export class TeacherController {
  private readonly attendance = new Map<string, Record<string, string>>();
  private readonly invalid = new Set<number>();
  constructor(private readonly store: StoreService) {}

  @Get('home')
  home() {
    return {
      nextLesson: { time: '10 h', className: '3ème B', students: 38 },
      currentTask: { title: 'Fractions : exercices 4 à 9', className: '3ème B', due: 'aujourd’hui, 18 h', done: 28, total: 38, doubts: 5 },
      classes: TEACHER_CLASSES,
    };
  }

  @Get('attendance')
  roll(@Query('classId') classId = '3b', @Query('date') date = 'today') {
    const saved = this.attendance.get(`${classId}:${date}`) ?? {};
    return STUDENT_NAMES.map((name, i) => ({ studentId: `s${i + 1}`, name, initials: initials(name), status: saved[`s${i + 1}`] ?? 'P' }));
  }

  /** §6.5 — l'appel notifie les parents des absents et des retardataires. */
  @Post('attendance')
  saveAttendance(@Body({ schema: attendanceSchema }) body: z.infer<typeof attendanceSchema>) {
    this.attendance.set(`${body.classId}:${body.date}`, Object.fromEntries(body.entries.map((e) => [e.studentId, e.status])));
    return { saved: body.entries.length, parentsNotified: body.entries.filter((e) => e.status !== 'P').length };
  }

  @Post('tasks')
  createTask(@Body({ schema: taskInputSchema }) body: z.infer<typeof taskInputSchema>) {
    const task = { id: `k${this.store.tasks.length + 1}`, title: body.title, subject: body.subject, type: body.type, due: body.due, status: 'todo' as const, estimate: body.estimateMinutes ? `${body.estimateMinutes} min` : '—' };
    this.store.tasks.push(task);
    return { task, notified: { students: 38, parents: 61 } };
  }

  @Get('tasks/:id/follow-up')
  followUp(@Param('id') id: string) {
    if (!this.store.tasks.some((t) => t.id === id)) throw new NotFoundException('Tâche introuvable.');
    const rows = STUDENT_NAMES.map((name, i) => {
      const [status, time, evaluation, proof] = FOLLOW_UP[i]!;
      const redo = this.invalid.has(i);
      return { index: i, name, initials: initials(name), status: redo ? 'redo' : status, time: redo ? 'points annulés' : time, evaluation, proof: proof && !redo };
    });
    return { rows, doubts: rows.filter((r) => r.evaluation === 'doubt').length };
  }

  /** §6.3 — Invalider : la tâche revient à faire et les points sont annulés. */
  @Post('tasks/:id/invalidate/:index')
  invalidate(@Param('index') index: string) {
    const i = Number(index);
    if (!Number.isInteger(i) || FOLLOW_UP[i]?.[0] !== 'done') throw new BadRequestException('Seule une tâche terminée peut être invalidée.');
    this.invalid.add(i);
    return { invalidated: true, pointsCancelled: 20 };
  }

  @Post('grades')
  publishGrades(@Body({ schema: gradeInputSchema }) body: z.infer<typeof gradeInputSchema>) {
    return { published: body.entries.length, notified: body.entries.length };
  }

  /** §6.7 — le type « Confidentiel » exige un référent vie scolaire confirmé (§7.10). */
  @Post('reports')
  report(@Body({ schema: reportInputSchema }) body: z.infer<typeof reportInputSchema>) {
    if (body.kind === 'confidentiel' && !this.store.referent?.confirmed) {
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
