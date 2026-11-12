import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Put } from '@nestjs/common';
import { announcementSchema, caseCloseSchema, caseEvaluationSchema, gradeCorrectionSchema, ATTENDANCE_STATUSES, JUSTIFICATIONS } from '@sge/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { StoreService } from '../common/store.service.js';
import { CasesService } from './cases.service.js';
import { SchoolPolicy } from './school.policy.js';

const absenceUpdate = z.object({ status: z.enum(ATTENDANCE_STATUSES), justification: z.enum(JUSTIFICATIONS).nullable().optional() });
const referentSchema = z.object({ name: z.string().trim().min(1), confirmed: z.boolean() });
const actionSchema = z.object({ label: z.string().trim().min(1), owner: z.enum(['Référente', 'Directrice', 'Prof. principal']) });

@Roles('etablissement')
@Controller('school')
export class SchoolLifeController {
  constructor(private readonly store: StoreService, private readonly policy: SchoolPolicy, private readonly cases: CasesService) {}

  @Get('absences')
  absences() {
    return this.store.absences;
  }

  /** §7.7 — modifier un statut ou ajouter une justification. */
  @Patch('absences/:id')
  updateAbsence(@Param('id') id: string, @Body({ schema: absenceUpdate }) body: z.infer<typeof absenceUpdate>) {
    this.policy.assertWritable();
    const a = this.store.absences.find((x) => x.id === id);
    if (!a) throw new NotFoundException();
    a.status = body.status;
    if (body.justification !== undefined) a.justification = body.justification;
    return a;
  }

  @Get('results')
  results() {
    const filled = this.store.results.filter((r) => r.value !== null).map((r) => r.value as number);
    return {
      className: '3ème B', subject: 'Mathématiques', term: '1er trimestre', evaluation: 'Interrogation n°2',
      average: filled.length ? filled.reduce((a, b) => a + b, 0) / filled.length : null,
      rows: this.store.results,
    };
  }

  /** §7.8 — corriger une note publiée : nouvelle valeur et motif obligatoire, visible tout de suite. */
  @Post('results/:id/correct')
  correct(@Param('id') id: string, @Body({ schema: gradeCorrectionSchema }) body: z.infer<typeof gradeCorrectionSchema>) {
    this.policy.assertWritable();
    const r = this.store.results.find((x) => x.id === id);
    if (!r || r.value === null) throw new NotFoundException();
    r.history.push({ from: r.value, to: body.value, reason: body.reason, at: new Date().toISOString() });
    r.value = body.value;
    return r;
  }

  @Get('announcements')
  announcements() {
    return this.store.announcements;
  }

  @Post('announcements')
  announce(@Body({ schema: announcementSchema }) body: z.infer<typeof announcementSchema>) {
    this.policy.assertWritable();
    const created = { id: `an${this.store.announcements.length + 1}`, title: body.title ?? '', message: body.message, audience: body.audience, target: body.target, at: new Date().toISOString() };
    this.store.announcements.unshift(created);
    return created;
  }

  /** §7.10 — sans référent confirmé, seuls les signalements « conduite / engagement » sont possibles. */
  @Get('referent')
  referent() {
    return { referent: this.store.referent, confidentialEnabled: !!this.store.referent?.confirmed, delays: { acknowledgeHours: 4, evaluationHours: 24 }, cases: this.cases.list() };
  }

  @Put('referent')
  setReferent(@Body({ schema: referentSchema }) body: z.infer<typeof referentSchema>) {
    this.policy.assertWritable();
    this.store.referent = body;
    return this.store.referent;
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
