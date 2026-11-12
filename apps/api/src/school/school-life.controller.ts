import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Put } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { announcementSchema, caseCloseSchema, caseEvaluationSchema, gradeCorrectionSchema, ATTENDANCE_STATUSES, JUSTIFICATIONS } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CurrentUser, Roles, schoolOf, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { absences, announcements, resultCorrections, results } from '../db/schema.js';
import { getSetting, setSetting } from '../db/settings.js';
import { CasesService } from './cases.service.js';
import { SchoolPolicy } from './school.policy.js';

const absenceUpdate = z.object({ status: z.enum(ATTENDANCE_STATUSES), justification: z.enum(JUSTIFICATIONS).nullable().optional() });
const referentSchema = z.object({ name: z.string().trim().min(1), confirmed: z.boolean() });
const actionSchema = z.object({ label: z.string().trim().min(1), owner: z.enum(['Référente', 'Directrice', 'Prof. principal']) });

@Roles('etablissement')
@Controller('school')
export class SchoolLifeController {
  constructor(@Inject(DB) private readonly db: Db, private readonly policy: SchoolPolicy, private readonly cases: CasesService) {}

  @Get('absences')
  absences(@CurrentUser() user: AuthUser) {
    return this.db.select().from(absences).where(eq(absences.schoolId, schoolOf(user))).orderBy(absences.id);
  }

  /** §7.7 — modifier un statut ou ajouter une justification. */
  @Patch('absences/:id')
  async updateAbsence(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: absenceUpdate }) body: z.infer<typeof absenceUpdate>) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    const set: Partial<typeof absences.$inferInsert> = { status: body.status };
    if (body.justification !== undefined) set.justification = body.justification;
    const [a] = await this.db.update(absences).set(set).where(and(eq(absences.id, id), eq(absences.schoolId, sid))).returning();
    if (!a) throw new NotFoundException();
    return a;
  }

  @Get('results')
  async results(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const rows = await this.db.select().from(results).where(eq(results.schoolId, sid)).orderBy(results.id);
    const corrections = await this.db.select({ c: resultCorrections }).from(resultCorrections).innerJoin(results, eq(results.id, resultCorrections.resultId)).where(eq(results.schoolId, sid)).orderBy(resultCorrections.id);
    const filled = rows.filter((r) => r.value !== null).map((r) => r.value as number);
    return {
      className: '3ème B', subject: 'Mathématiques', term: '1er trimestre', evaluation: 'Interrogation n°2',
      average: filled.length ? filled.reduce((a, b) => a + b, 0) / filled.length : null,
      rows: rows.map((r) => ({ ...r, history: corrections.filter(({ c }) => c.resultId === r.id).map(({ c }) => ({ from: c.fromValue, to: c.toValue, reason: c.reason, at: c.at })) })),
    };
  }

  /** §7.8 — corriger une note publiée : nouvelle valeur et motif obligatoire (historisés), visible tout de suite. */
  @Post('results/:id/correct')
  async correct(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: gradeCorrectionSchema }) body: z.infer<typeof gradeCorrectionSchema>) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    return this.db.transaction(async (tx) => {
      const [r] = await tx.select().from(results).where(and(eq(results.id, id), eq(results.schoolId, sid))).for('update');
      if (!r || r.value === null) throw new NotFoundException();
      await tx.insert(resultCorrections).values({ resultId: id, fromValue: r.value, toValue: body.value, reason: body.reason });
      const [updated] = await tx.update(results).set({ value: body.value }).where(eq(results.id, id)).returning();
      return updated;
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
  async referent(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const referent = await getSetting(this.db, sid, 'referent');
    return { referent, confidentialEnabled: !!referent?.confirmed, delays: { acknowledgeHours: 4, evaluationHours: 24 }, cases: await this.cases.list(sid) };
  }

  @Put('referent')
  async setReferent(@CurrentUser() user: AuthUser, @Body({ schema: referentSchema }) body: z.infer<typeof referentSchema>) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    await setSetting(this.db, sid, 'referent', body);
    return body;
  }

  @Get('cases/:id')
  caseDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cases.detail(id, schoolOf(user));
  }

  @Post('cases/:id/acknowledge')
  ack(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cases.acknowledge(id, schoolOf(user));
  }

  @Post('cases/:id/evaluate')
  evaluate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: caseEvaluationSchema }) body: z.infer<typeof caseEvaluationSchema>) {
    return this.cases.evaluate(id, schoolOf(user), body);
  }

  @Post('cases/:id/actions')
  addAction(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: actionSchema }) body: z.infer<typeof actionSchema>) {
    return this.cases.addAction(id, schoolOf(user), body.label, body.owner);
  }

  @Post('cases/:id/actions/:index/toggle')
  toggle(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('index') index: string) {
    return this.cases.toggleAction(id, schoolOf(user), Number(index));
  }

  @Post('cases/:id/prepare-close')
  prepareClose(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cases.toClose(id, schoolOf(user));
  }

  @Post('cases/:id/close')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: caseCloseSchema }) body: z.infer<typeof caseCloseSchema>) {
    return this.cases.close(id, schoolOf(user), body);
  }
}
