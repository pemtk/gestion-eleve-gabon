import { Body, Controller, Get, Inject, Ip, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { announcementSchema, caseCloseSchema, caseEvaluationSchema, gradeCorrectionSchema, ATTENDANCE_STATUSES, JUSTIFICATIONS } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CurrentUser, Roles, schoolOf, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { announcements, attendanceRecords, classes, evaluations, gradeCorrections, grades, students } from '../db/schema.js';
import { dateLabel } from '../learning/results.js';
import { getSetting, setSetting } from '../db/settings.js';
import { AuditService } from '../audit/audit.service.js';
import { CasesService } from './cases.service.js';
import { SchoolPolicy } from './school.policy.js';

const absenceUpdate = z.object({ status: z.enum(ATTENDANCE_STATUSES), justification: z.enum(JUSTIFICATIONS).nullable().optional() });
const TERMS: Record<string, string> = { T1: '1er trimestre', T2: '2ème trimestre', T3: '3ème trimestre' };
const referentSchema = z.object({ name: z.string().trim().min(1), confirmed: z.boolean() });
const actionSchema = z.object({ label: z.string().trim().min(1), owner: z.enum(['Référente', 'Directrice', 'Prof. principal']) });

@Roles('etablissement')
@Controller('school')
export class SchoolLifeController {
  constructor(@Inject(DB) private readonly db: Db, private readonly policy: SchoolPolicy, private readonly cases: CasesService, private readonly audit: AuditService) {}

  /** Trace l'accès (ou la tentative refusée) à un signalement confidentiel. */
  private trace<T>(user: AuthUser, ip: string, action: string, id: string | null, fn: () => Promise<T>, details?: Record<string, unknown>) {
    return this.audit.traced({ action, resourceType: 'case', resourceId: id, user, ip, details }, fn);
  }

  /** Absences et retards : vue de l'appel des enseignants (une seule source : `attendance_records`). */
  @Get('absences')
  async absences(@CurrentUser() user: AuthUser) {
    const rows = await this.db.select({ r: attendanceRecords, firstName: students.firstName, lastName: students.lastName, className: classes.name })
      .from(attendanceRecords).innerJoin(students, eq(students.id, attendanceRecords.studentId)).innerJoin(classes, eq(classes.id, attendanceRecords.classId))
      .where(and(eq(attendanceRecords.schoolId, schoolOf(user)), ne(attendanceRecords.status, 'P'))).orderBy(desc(attendanceRecords.date), attendanceRecords.id);
    return rows.map(({ r, firstName, lastName, className }) => ({ id: String(r.id), studentId: r.studentId, student: `${firstName} ${lastName}`, className, date: r.date, dateLabel: dateLabel(r.date), status: r.status, justification: r.justification }));
  }

  /** §7.7 — modifier un statut ou ajouter une justification. */
  @Patch('absences/:id')
  async updateAbsence(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: absenceUpdate }) body: z.infer<typeof absenceUpdate>) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    if (!/^\d+$/.test(id)) throw new NotFoundException();
    const set: Partial<typeof attendanceRecords.$inferInsert> = { status: body.status };
    if (body.justification !== undefined) set.justification = body.justification;
    const [a] = await this.db.update(attendanceRecords).set(set).where(and(eq(attendanceRecords.id, Number(id)), eq(attendanceRecords.schoolId, sid))).returning();
    if (!a) throw new NotFoundException();
    return { id: String(a.id), status: a.status, justification: a.justification };
  }

  /**
   * Résultats d'une évaluation (la plus récente par défaut, ou `?evaluation=`) : une ligne par élève de la classe,
   * « non saisie » pour ceux qui n'ont pas de note.
   */
  @Get('results')
  async results(@CurrentUser() user: AuthUser, @Query('evaluation') evaluationId?: string) {
    const sid = schoolOf(user);
    const all = await this.db.select({ e: evaluations, className: classes.name }).from(evaluations).innerJoin(classes, eq(classes.id, evaluations.classId)).where(eq(evaluations.schoolId, sid)).orderBy(desc(evaluations.heldOn), desc(evaluations.createdAt));
    const list = all.map(({ e, className }) => ({ id: e.id, label: e.label, subject: e.subject, trimester: e.trimester, className }));
    const picked = all.find(({ e }) => e.id === evaluationId) ?? all[0];
    if (!picked) return { evaluations: list, evaluationId: null, className: '', subject: '', term: '', evaluation: '', average: null, rows: [] };
    const { e, className } = picked;
    const roster = await this.db.select().from(students).where(and(eq(students.schoolId, sid), eq(students.classId, e.classId))).orderBy(students.firstName, students.lastName);
    const given = await this.db.select().from(grades).where(eq(grades.evaluationId, e.id));
    const corrections = given.length ? await this.db.select().from(gradeCorrections).where(inArray(gradeCorrections.gradeId, given.map((g) => g.id))).orderBy(gradeCorrections.id) : [];
    const values = given.map((g) => g.value);
    return {
      evaluations: list, evaluationId: e.id, className, subject: e.subject, term: TERMS[e.trimester] ?? e.trimester, evaluation: e.label,
      average: values.length ? values.reduce((x, y) => x + y, 0) / values.length : null,
      rows: roster.map((st) => {
        const g = given.find((x) => x.studentId === st.id);
        return { id: g ? String(g.id) : null, student: `${st.firstName} ${st.lastName}`, value: g?.value ?? null, coefficient: e.coefficient, published: !!g, history: corrections.filter((c) => c.gradeId === g?.id).map((c) => ({ from: c.fromValue, to: c.toValue, reason: c.reason, at: c.at })) };
      }),
    };
  }

  /** §7.8 — corriger une note publiée : nouvelle valeur et motif obligatoire (historisés), visible tout de suite. */
  @Post('results/:id/correct')
  async correct(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: gradeCorrectionSchema }) body: z.infer<typeof gradeCorrectionSchema>) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    if (!/^\d+$/.test(id)) throw new NotFoundException();
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select({ g: grades }).from(grades).innerJoin(evaluations, eq(evaluations.id, grades.evaluationId)).where(and(eq(grades.id, Number(id)), eq(evaluations.schoolId, sid))).for('update', { of: grades });
      if (!row) throw new NotFoundException();
      await tx.insert(gradeCorrections).values({ gradeId: row.g.id, fromValue: row.g.value, toValue: body.value, reason: body.reason });
      const [updated] = await tx.update(grades).set({ value: body.value }).where(eq(grades.id, row.g.id)).returning();
      return { id: String(updated!.id), value: updated!.value };
    });
  }

  @Get('announcements')
  list(@CurrentUser() user: AuthUser) {
    return this.db.select().from(announcements).where(eq(announcements.schoolId, schoolOf(user))).orderBy(desc(announcements.at));
  }

  @Post('announcements')
  async announce(@CurrentUser() user: AuthUser, @Body({ schema: announcementSchema }) body: z.infer<typeof announcementSchema>) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    const [a] = await this.db.insert(announcements).values({ id: randomUUID(), schoolId: sid, title: body.title ?? '', message: body.message, audience: body.audience, target: body.target }).returning();
    return a;
  }

  /** §7.10 — sans référent confirmé, seuls les signalements « conduite / engagement » sont possibles. */
  @Get('referent')
  async referent(@CurrentUser() user: AuthUser, @Ip() ip: string) {
    const sid = schoolOf(user);
    const referent = await getSetting(this.db, sid, 'referent');
    const cases = await this.trace(user, ip, 'case.list', null, () => this.cases.list(sid));
    return { referent, confidentialEnabled: !!referent?.confirmed, delays: { acknowledgeHours: 4, evaluationHours: 24 }, cases, conduct: await this.cases.conduct(sid) };
  }

  @Put('referent')
  async setReferent(@CurrentUser() user: AuthUser, @Body({ schema: referentSchema }) body: z.infer<typeof referentSchema>, @Ip() ip: string) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    await setSetting(this.db, sid, 'referent', body);
    await this.audit.record({ action: 'case.referent.update', resourceType: 'setting', resourceId: 'referent', user, ip });
    return body;
  }

  @Get('cases/:id')
  caseDetail(@CurrentUser() user: AuthUser, @Param('id') id: string, @Ip() ip: string) {
    return this.trace(user, ip, 'case.read', id, () => this.cases.detail(id, schoolOf(user)));
  }

  @Post('cases/:id/acknowledge')
  ack(@CurrentUser() user: AuthUser, @Param('id') id: string, @Ip() ip: string) {
    return this.trace(user, ip, 'case.acknowledge', id, () => this.cases.acknowledge(id, schoolOf(user)));
  }

  @Post('cases/:id/evaluate')
  evaluate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: caseEvaluationSchema }) body: z.infer<typeof caseEvaluationSchema>, @Ip() ip: string) {
    return this.trace(user, ip, 'case.evaluate', id, () => this.cases.evaluate(id, schoolOf(user), body), { gravity: body.gravity });
  }

  @Post('cases/:id/actions')
  addAction(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: actionSchema }) body: z.infer<typeof actionSchema>, @Ip() ip: string) {
    return this.trace(user, ip, 'case.action.add', id, () => this.cases.addAction(id, schoolOf(user), body.label, body.owner));
  }

  @Post('cases/:id/actions/:index/toggle')
  toggle(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('index') index: string, @Ip() ip: string) {
    return this.trace(user, ip, 'case.action.toggle', id, () => this.cases.toggleAction(id, schoolOf(user), Number(index)), { index: Number(index) });
  }

  @Post('cases/:id/prepare-close')
  prepareClose(@CurrentUser() user: AuthUser, @Param('id') id: string, @Ip() ip: string) {
    return this.trace(user, ip, 'case.prepare_close', id, () => this.cases.toClose(id, schoolOf(user)));
  }

  @Post('cases/:id/close')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: caseCloseSchema }) body: z.infer<typeof caseCloseSchema>, @Ip() ip: string) {
    return this.trace(user, ip, 'case.close', id, () => this.cases.close(id, schoolOf(user), body));
  }
}
