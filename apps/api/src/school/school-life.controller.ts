import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Put } from '@nestjs/common';
import { desc, eq, isNotNull } from 'drizzle-orm';
import { announcementSchema, caseCloseSchema, caseEvaluationSchema, gradeCorrectionSchema, ATTENDANCE_STATUSES, JUSTIFICATIONS } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
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
  absences() {
    return this.db.select().from(absences).orderBy(absences.id);
  }

  /** §7.7 — modifier un statut ou ajouter une justification. */
  @Patch('absences/:id')
  async updateAbsence(@Param('id') id: string, @Body({ schema: absenceUpdate }) body: z.infer<typeof absenceUpdate>) {
    await this.policy.assertWritable();
    const set: Partial<typeof absences.$inferInsert> = { status: body.status };
    if (body.justification !== undefined) set.justification = body.justification;
    const [a] = await this.db.update(absences).set(set).where(eq(absences.id, id)).returning();
    if (!a) throw new NotFoundException();
    return a;
  }

  @Get('results')
  async results() {
    const rows = await this.db.select().from(results).orderBy(results.id);
    const corrections = await this.db.select().from(resultCorrections).orderBy(resultCorrections.id);
    const filled = rows.filter((r) => r.value !== null).map((r) => r.value as number);
    return {
      className: '3ème B', subject: 'Mathématiques', term: '1er trimestre', evaluation: 'Interrogation n°2',
      average: filled.length ? filled.reduce((a, b) => a + b, 0) / filled.length : null,
      rows: rows.map((r) => ({ ...r, history: corrections.filter((c) => c.resultId === r.id).map((c) => ({ from: c.fromValue, to: c.toValue, reason: c.reason, at: c.at })) })),
    };
  }

  /** §7.8 — corriger une note publiée : nouvelle valeur et motif obligatoire (historisés), visible tout de suite. */
  @Post('results/:id/correct')
  async correct(@Param('id') id: string, @Body({ schema: gradeCorrectionSchema }) body: z.infer<typeof gradeCorrectionSchema>) {
    await this.policy.assertWritable();
    return this.db.transaction(async (tx) => {
      const [r] = await tx.select().from(results).where(eq(results.id, id)).for('update');
      if (!r || r.value === null) throw new NotFoundException();
      await tx.insert(resultCorrections).values({ resultId: id, fromValue: r.value, toValue: body.value, reason: body.reason });
      const [updated] = await tx.update(results).set({ value: body.value }).where(eq(results.id, id)).returning();
      return updated;
    });
  }

  @Get('announcements')
  list() {
    return this.db.select().from(announcements).where(isNotNull(announcements.at)).orderBy(desc(announcements.at));
  }

  @Post('announcements')
  async announce(@Body({ schema: announcementSchema }) body: z.infer<typeof announcementSchema>) {
    await this.policy.assertWritable();
    const [a] = await this.db.insert(announcements).values({ id: randomUUID(), title: body.title ?? '', message: body.message, audience: body.audience, target: body.target }).returning();
    return a;
  }

  /** §7.10 — sans référent confirmé, seuls les signalements « conduite / engagement » sont possibles. */
  @Get('referent')
  async referent() {
    const referent = await getSetting(this.db, 'referent');
    return { referent, confidentialEnabled: !!referent?.confirmed, delays: { acknowledgeHours: 4, evaluationHours: 24 }, cases: await this.cases.list() };
  }

  @Put('referent')
  async setReferent(@Body({ schema: referentSchema }) body: z.infer<typeof referentSchema>) {
    await this.policy.assertWritable();
    await setSetting(this.db, 'referent', body);
    return body;
  }

  @Get('cases/:id')
  caseDetail(@Param('id') id: string) {
    return this.cases.detail(id);
  }

  @Post('cases/:id/acknowledge')
  ack(@Param('id') id: string) {
    return this.cases.acknowledge(id);
  }

  @Post('cases/:id/evaluate')
  evaluate(@Param('id') id: string, @Body({ schema: caseEvaluationSchema }) body: z.infer<typeof caseEvaluationSchema>) {
    return this.cases.evaluate(id, body);
  }

  @Post('cases/:id/actions')
  addAction(@Param('id') id: string, @Body({ schema: actionSchema }) body: z.infer<typeof actionSchema>) {
    return this.cases.addAction(id, body.label, body.owner);
  }

  @Post('cases/:id/actions/:index/toggle')
  toggle(@Param('id') id: string, @Param('index') index: string) {
    return this.cases.toggleAction(id, Number(index));
  }

  @Post('cases/:id/prepare-close')
  prepareClose(@Param('id') id: string) {
    return this.cases.toClose(id);
  }

  @Post('cases/:id/close')
  close(@Param('id') id: string, @Body({ schema: caseCloseSchema }) body: z.infer<typeof caseCloseSchema>) {
    return this.cases.close(id, body);
  }
}
