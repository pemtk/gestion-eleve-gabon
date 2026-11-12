import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { ANNOUNCE_TEMPLATES, attendanceSchema, formatCode, gradeInputSchema, initials, reportInputSchema, taskInputSchema } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CurrentUser, Roles, schoolOf, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { announcements, attendanceRecords, cases, classes, evaluations, grades, learner, studentParents, students, taskCompletions, tasks } from '../db/schema.js';
import { getSetting } from '../db/settings.js';
import { assertTeaches, teacherClasses } from './context.js';

const todayIso = () => new Date().toISOString().slice(0, 10);
const announceSchema = z.object({ classId: z.string(), message: z.string().trim().min(1), attachment: z.string().optional() });
const POINTS_PER_TASK = 20;

/**
 * Espace enseignant : tout part de ses affectations (enseignant × classe × matière). Une classe qui n'y figure pas
 * est « introuvable » (404), y compris dans la même école.
 */
@Roles('enseignant')
@Controller('me/teacher')
export class TeacherController {
  constructor(@Inject(DB) private readonly db: Db) {}

  private roster(schoolId: string, classId: string) {
    return this.db.select().from(students).where(and(eq(students.schoolId, schoolId), eq(students.classId, classId))).orderBy(asc(students.firstName), asc(students.lastName));
  }

  /** Part des tâches faites dans une classe : tâches terminées / (tâches × élèves). */
  private async completionRate(schoolId: string, classId: string, studentCount: number) {
    const taskIds = (await this.db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.schoolId, schoolId), eq(tasks.classId, classId)))).map((t) => t.id);
    if (!taskIds.length || !studentCount) return 0;
    const [{ n }] = await this.db.select({ n: count() }).from(taskCompletions).where(and(inArray(taskCompletions.taskId, taskIds), eq(taskCompletions.status, 'done')));
    return Math.round((n / (taskIds.length * studentCount)) * 100);
  }

  @Get('classes')
  async classes(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const mine = await teacherClasses(this.db, user);
    return Promise.all(mine.classes.map(async (c) => ({ id: c.classId, name: c.className, subject: c.subject, principal: c.principal, students: c.students, pct: await this.completionRate(sid, c.classId, c.students) })));
  }

  @Get('home')
  async home(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const mine = await teacherClasses(this.db, user);
    const classList = await Promise.all(mine.classes.map(async (c) => ({ id: c.classId, name: c.className, subject: c.subject, principal: c.principal, students: c.students, pct: await this.completionRate(sid, c.classId, c.students) })));
    const [last] = mine.teacherId ? await this.db.select().from(tasks).where(and(eq(tasks.schoolId, sid), eq(tasks.teacherId, mine.teacherId))).orderBy(desc(tasks.position)).limit(1) : [];
    let currentTask = null;
    if (last) {
      const cls = mine.classes.find((c) => c.classId === last.classId);
      const rows = await this.db.select().from(taskCompletions).where(eq(taskCompletions.taskId, last.id));
      currentTask = { id: last.id, title: last.title, className: cls?.className ?? '', due: last.due, done: rows.filter((r) => r.status === 'done').length, total: cls?.students ?? 0, doubts: rows.filter((r) => r.status === 'done' && r.evaluation === 'doubt').length };
    }
    return { mainClass: classList.find((c) => c.principal) ?? classList[0] ?? null, currentTask, classes: classList };
  }

  @Get('classes/:classId/students')
  async classStudents(@CurrentUser() user: AuthUser, @Param('classId') classId: string) {
    await assertTeaches(this.db, user, classId);
    return (await this.roster(schoolOf(user), classId)).map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, initials: initials(`${s.firstName} ${s.lastName}`) }));
  }

  /** Appel d'un jour : un élève sans ligne est « présent » par défaut. */
  @Get('attendance')
  async roll(@CurrentUser() user: AuthUser, @Query('classId') classId: string, @Query('date') date = todayIso()) {
    if (!classId) throw new BadRequestException('Choisissez une classe.');
    const sid = schoolOf(user);
    await assertTeaches(this.db, user, classId);
    const saved = await this.db.select().from(attendanceRecords).where(and(eq(attendanceRecords.schoolId, sid), eq(attendanceRecords.classId, classId), eq(attendanceRecords.date, date)));
    return (await this.roster(sid, classId)).map((s) => {
      const r = saved.find((x) => x.studentId === s.id);
      return { studentId: s.id, name: `${s.firstName} ${s.lastName}`, initials: initials(`${s.firstName} ${s.lastName}`), status: r?.status ?? 'P', justification: r?.justification ?? null };
    });
  }

  /** §6.5 — enregistre l'appel (rejouable : une ligne par classe, jour et élève). Les parents des absents/retardataires sont à prévenir. */
  @Post('attendance')
  async saveAttendance(@CurrentUser() user: AuthUser, @Body({ schema: attendanceSchema }) body: z.infer<typeof attendanceSchema>) {
    const sid = schoolOf(user);
    await assertTeaches(this.db, user, body.classId);
    const ids = new Set((await this.roster(sid, body.classId)).map((s) => s.id));
    if (body.entries.some((e) => !ids.has(e.studentId))) throw new BadRequestException('Un élève de l’appel n’appartient pas à cette classe.');
    if (body.entries.length) {
      await this.db.insert(attendanceRecords).values(body.entries.map((e) => ({ schoolId: sid, classId: body.classId, studentId: e.studentId, date: body.date, status: e.status, justification: e.status === 'P' ? null : (e.justification ?? null), takenBy: user.sub })))
        .onConflictDoUpdate({ target: [attendanceRecords.classId, attendanceRecords.date, attendanceRecords.studentId], set: { status: sql`excluded.status`, justification: sql`excluded.justification`, takenBy: sql`excluded.taken_by` } });
    }
    return { saved: body.entries.length, parentsNotified: body.entries.filter((e) => e.status !== 'P').length };
  }

  @Get('tasks')
  async myTasks(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const mine = await teacherClasses(this.db, user);
    if (!mine.teacherId) return [];
    const list = await this.db.select().from(tasks).where(and(eq(tasks.schoolId, sid), eq(tasks.teacherId, mine.teacherId))).orderBy(desc(tasks.position));
    const done = list.length ? await this.db.select().from(taskCompletions).where(and(inArray(taskCompletions.taskId, list.map((t) => t.id)), eq(taskCompletions.status, 'done'))) : [];
    return list.map((t) => {
      const c = mine.classes.find((x) => x.classId === t.classId);
      return { id: t.id, title: t.title, className: c?.className ?? '', due: t.due, done: done.filter((d) => d.taskId === t.id).length, total: c?.students ?? 0 };
    });
  }

  /** Publication d'une tâche pour UNE classe de l'enseignant ; sa matière est celle de l'affectation. */
  @Post('tasks')
  async createTask(@CurrentUser() user: AuthUser, @Body({ schema: taskInputSchema }) body: z.infer<typeof taskInputSchema>) {
    const sid = schoolOf(user);
    // La matière est celle de l'affectation (celle demandée si l'enseignant l'enseigne dans cette classe, sinon sa première).
    const all = await teacherClasses(this.db, user);
    const mine = all.classes.find((c) => c.classId === body.classId && c.subject === body.subject) ?? all.classes.find((c) => c.classId === body.classId);
    if (!all.teacherId || !mine) throw new NotFoundException('Classe introuvable dans vos affectations.');
    const teacherId = all.teacherId;
    const [task] = await this.db.insert(tasks).values({
      id: randomUUID(), schoolId: sid, classId: body.classId, teacherId, title: body.title, description: body.description, subject: mine.subject,
      type: body.type, due: body.due, estimate: body.estimateMinutes ? `${body.estimateMinutes} min` : '—', requirePhoto: body.requirePhoto, graded: body.graded,
    }).returning();
    const [{ parents }] = await this.db.select({ parents: count() }).from(studentParents).innerJoin(students, eq(students.id, studentParents.studentId)).where(and(eq(students.schoolId, sid), eq(students.classId, body.classId)));
    return { task, notified: { students: mine.students, parents } };
  }

  /** Une ligne par élève de la classe : pas commencé, en cours, terminé (avec temps, auto-évaluation, preuve) ou à refaire. */
  @Get('tasks/:id/follow-up')
  async followUp(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const sid = schoolOf(user);
    const [t] = await this.db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.schoolId, sid)));
    if (!t) throw new NotFoundException('Tâche introuvable.');
    const cls = await assertTeaches(this.db, user, t.classId);
    const done = await this.db.select().from(taskCompletions).where(eq(taskCompletions.taskId, id));
    const rows = (await this.roster(sid, t.classId)).map((s) => {
      const c = done.find((x) => x.studentId === s.id);
      const status = c?.status === 'done' || c?.status === 'doing' || c?.status === 'redo' ? c.status : 'none';
      const time = status === 'redo' ? 'points annulés' : status === 'none' || !c?.seconds ? '—' : `${Math.max(1, Math.round(c.seconds / 60))} min`;
      return { studentId: s.id, name: `${s.firstName} ${s.lastName}`, initials: initials(`${s.firstName} ${s.lastName}`), status, time, evaluation: status === 'done' ? (c?.evaluation ?? '') : '', proof: status === 'done' && !!c?.proof };
    });
    return { task: { id: t.id, title: t.title, due: t.due, className: cls.className }, rows, doubts: rows.filter((r) => r.evaluation === 'doubt').length };
  }

  /** §6.3 — Invalider : la tâche revient à faire pour cet élève et les points sont annulés. */
  @Post('tasks/:id/invalidate/:studentId')
  async invalidate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('studentId') studentId: string) {
    const sid = schoolOf(user);
    const [t] = await this.db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.schoolId, sid)));
    if (!t) throw new NotFoundException('Tâche introuvable.');
    await assertTeaches(this.db, user, t.classId);
    return this.db.transaction(async (tx) => {
      const [c] = await tx.select().from(taskCompletions).where(and(eq(taskCompletions.taskId, id), eq(taskCompletions.studentId, studentId))).for('update');
      if (!c) throw new NotFoundException('Cet élève n’a pas commencé cette tâche.');
      if (c.status !== 'done') throw new BadRequestException('Seule une tâche terminée peut être invalidée.');
      await tx.update(taskCompletions).set({ status: 'redo', points: 0, invalidatedAt: new Date() }).where(and(eq(taskCompletions.taskId, id), eq(taskCompletions.studentId, studentId)));
      const [s] = await tx.select({ userId: students.userId }).from(students).where(eq(students.id, studentId));
      if (s?.userId && c.points) await tx.update(learner).set({ points: sql`greatest(${learner.points} - ${c.points}, 0)` }).where(eq(learner.userId, s.userId));
      return { invalidated: true, pointsCancelled: c.points || POINTS_PER_TASK };
    });
  }

  /**
   * Publication des notes d'une évaluation (classe × matière × trimestre × libellé) : l'élève et le parent les voient aussitôt.
   * Rejouable : l'évaluation est unique, une note déjà publiée n'est jamais écrasée (la correction passe par l'école, avec motif).
   */
  @Post('grades')
  async publishGrades(@CurrentUser() user: AuthUser, @Body({ schema: gradeInputSchema }) body: z.infer<typeof gradeInputSchema>) {
    const sid = schoolOf(user);
    const mine = await assertTeaches(this.db, user, body.classId, body.subject);
    const ids = new Set((await this.roster(sid, body.classId)).map((s) => s.id));
    if (!body.entries.length) throw new BadRequestException('Saisissez au moins une note.');
    if (body.entries.some((e) => !ids.has(e.studentId))) throw new BadRequestException('Une note concerne un élève qui n’est pas dans cette classe.');
    return this.db.transaction(async (tx) => {
      await tx.insert(evaluations).values({ id: randomUUID(), schoolId: sid, classId: body.classId, subject: body.subject, trimester: body.trimester, label: body.label, coefficient: body.coefficient, heldOn: todayIso(), teacherId: mine.teacherId }).onConflictDoNothing();
      const [ev] = await tx.select().from(evaluations).where(and(eq(evaluations.classId, body.classId), eq(evaluations.subject, body.subject), eq(evaluations.trimester, body.trimester), eq(evaluations.label, body.label)));
      const inserted = await tx.insert(grades).values(body.entries.map((e) => ({ evaluationId: ev!.id, studentId: e.studentId, value: e.value, comment: e.comment }))).onConflictDoNothing().returning({ id: grades.id });
      return { evaluationId: ev!.id, published: inserted.length, alreadyPublished: body.entries.length - inserted.length, notified: inserted.length };
    });
  }

  /**
   * §6.7 — signalement d'un élève de ses classes. « Confidentiel » exige un référent confirmé (§7.10) et crée un dossier
   * traité par le référent ; « conduite » est visible de l'école.
   */
  @Post('reports')
  async report(@CurrentUser() user: AuthUser, @Body({ schema: reportInputSchema }) body: z.infer<typeof reportInputSchema>) {
    const sid = schoolOf(user);
    const [s] = await this.db.select({ s: students, className: classes.name }).from(students).innerJoin(classes, eq(classes.id, students.classId)).where(and(eq(students.id, body.studentId), eq(students.schoolId, sid)));
    if (!s) throw new NotFoundException('Élève introuvable.');
    await assertTeaches(this.db, user, s.s.classId);
    if (body.kind === 'confidentiel' && !(await getSetting(this.db, sid, 'referent'))?.confirmed) {
      throw new BadRequestException('Aucun référent vie scolaire désigné : seul le signalement « Conduite / engagement » est disponible.');
    }
    const confidential = body.kind === 'confidentiel';
    const seq = await this.db.execute(sql`select nextval('case_number_seq') as n`);
    const id = `SC-${String((seq.rows[0] as { n: string }).n).padStart(4, '0')}`;
    const at = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    await this.db.insert(cases).values({
      id, schoolId: sid, reporter: `Enseignant · ${user.name}`, reporterId: user.sub, className: s.className, type: confidential ? 'Confidentiel' : 'Conduite / engagement',
      kind: body.kind, received: 'à l’instant', student: `${s.s.firstName} ${s.s.lastName}`, studentId: s.s.id, text: body.description, log: [{ at, event: 'Signalement reçu' }],
    });
    return { sent: true, caseId: id, referentNotified: confidential, detailShared: !confidential };
  }

  @Get('announcement-templates')
  templates() {
    return ANNOUNCE_TEMPLATES;
  }

  /** Annonce à UNE classe de l'enseignant : conservée, avec le nombre réel d'élèves et de parents concernés. */
  @Post('announcements')
  async announce(@CurrentUser() user: AuthUser, @Body({ schema: announceSchema }) body: z.infer<typeof announceSchema>) {
    const sid = schoolOf(user);
    const cls = await assertTeaches(this.db, user, body.classId);
    const [{ parents }] = await this.db.select({ parents: count() }).from(studentParents).innerJoin(students, eq(students.id, studentParents.studentId)).where(and(eq(students.schoolId, sid), eq(students.classId, body.classId)));
    const [a] = await this.db.insert(announcements).values({ id: randomUUID(), schoolId: sid, title: '', message: body.message, audience: 'class', target: cls.className, authorId: user.sub, classId: body.classId }).returning();
    return { sent: true, id: a!.id, recipients: { students: cls.students, parents }, smsRelay: true, message: body.message };
  }

  /** Codes d'invitation des parents d'une classe, avec le nombre de parents déjà rattachés (2 au plus). */
  @Get('parent-codes')
  async codes(@CurrentUser() user: AuthUser, @Query('classId') classId: string) {
    const sid = schoolOf(user);
    await assertTeaches(this.db, user, classId);
    const roster = await this.roster(sid, classId);
    const links = roster.length ? await this.db.select({ studentId: studentParents.studentId, n: count() }).from(studentParents).where(inArray(studentParents.studentId, roster.map((s) => s.id))).groupBy(studentParents.studentId) : [];
    return roster.map((s) => ({ studentId: s.id, name: `${s.firstName} ${s.lastName}`, initials: initials(`${s.firstName} ${s.lastName}`), code: formatCode(s.code), linked: links.find((l) => l.studentId === s.id)?.n ?? 0, validUntil: '31 décembre 2026' }));
  }
}
