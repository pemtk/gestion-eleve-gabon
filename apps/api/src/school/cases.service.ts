import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { caseCloseSchema, caseEvaluationSchema } from '@sge/shared';
import type { z } from 'zod';
import { DB, type Db } from '../db/db.module.js';
import { cases } from '../db/schema.js';

type CaseRow = typeof cases.$inferSelect;
const now = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const logEntry = (event: string) => sql`${cases.log} || ${JSON.stringify([{ at: now(), event }])}::jsonb`;

/** État d'un dossier tel que l'attend l'interface. */
const toState = (c: CaseRow) => ({ id: c.id, step: c.step as 1 | 2 | 3 | 4 | 5, gravity: c.gravity ?? undefined, measures: c.measures, informDirector: c.informDirector, informFamily: c.informFamily, actions: c.actions, summary: c.summary ?? undefined, log: c.log });
const toInfo = (c: CaseRow) => ({ id: c.id, reporter: c.reporter, className: c.className, type: c.type, received: c.received, student: c.student, text: c.text });

/**
 * Traitement d'un signalement confidentiel (§11.2) :
 * accusé de réception (4 h) → première évaluation (24 h) → plan d'action → clôture avec la directrice.
 * Chaque transition est un UPDATE conditionnel sur l'étape courante : deux clics simultanés ne la passent qu'une fois.
 * Tous les accès sont limités à l'établissement de l'appelant : un dossier d'une autre école reste introuvable (404).
 */
@Injectable()
export class CasesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  private async get(id: string, schoolId: string): Promise<CaseRow> {
    const [row] = await this.db.select().from(cases).where(and(eq(cases.id, id), eq(cases.schoolId, schoolId), eq(cases.kind, 'confidentiel')));
    if (!row) throw new NotFoundException('Signalement introuvable.');
    return row;
  }

  async list(schoolId: string) {
    return (await this.db.select().from(cases).where(and(eq(cases.schoolId, schoolId), eq(cases.kind, 'confidentiel'))).orderBy(cases.id)).map((c) => ({ ...toInfo(c), step: c.step }));
  }

  /** Signalements « conduite / engagement » : visibles de l'école, sans processus de traitement du référent. */
  async conduct(schoolId: string) {
    return (await this.db.select().from(cases).where(and(eq(cases.schoolId, schoolId), eq(cases.kind, 'conduite'))).orderBy(sql`${cases.createdAt} desc`)).map(toInfo);
  }

  async detail(id: string, schoolId: string) {
    const c = await this.get(id, schoolId);
    return { info: toInfo(c), state: toState(c) };
  }

  private async transition(id: string, schoolId: string, from: number, set: Partial<typeof cases.$inferInsert>) {
    await this.get(id, schoolId);
    const [row] = await this.db.update(cases).set(set).where(and(eq(cases.id, id), eq(cases.schoolId, schoolId), eq(cases.step, from))).returning();
    if (!row) throw new BadRequestException('Cette étape n’est pas disponible pour ce dossier.');
    return toState(row);
  }

  acknowledge(id: string, schoolId: string) {
    return this.transition(id, schoolId, 1, { step: 2, log: logEntry('Accusé de réception · l’auteur est informé') as never });
  }

  evaluate(id: string, schoolId: string, input: z.infer<typeof caseEvaluationSchema>) {
    const event = `Évaluation : gravité ${input.gravity.toLowerCase()}${input.informDirector ? ' · directrice informée' : ''}${input.informFamily ? ' · famille prévenue' : ''}`;
    return this.transition(id, schoolId, 2, { step: 3, gravity: input.gravity, measures: input.measures, informDirector: input.informDirector, informFamily: input.informFamily, log: logEntry(event) as never });
  }

  async addAction(id: string, schoolId: string, label: string, owner: string) {
    const action = { label, owner, due: 'sous 7 j', done: false };
    const [row] = await this.db.update(cases).set({ actions: sql`${cases.actions} || ${JSON.stringify([action])}::jsonb` as never, log: logEntry(`Action ajoutée : ${label}`) as never }).where(and(eq(cases.id, id), eq(cases.schoolId, schoolId), eq(cases.step, 3))).returning();
    if (!row) { await this.get(id, schoolId); throw new BadRequestException('Cette étape n’est pas disponible pour ce dossier.'); }
    return toState(row);
  }

  async toggleAction(id: string, schoolId: string, index: number) {
    const c = await this.get(id, schoolId);
    if (!c.actions[index]) throw new NotFoundException('Action introuvable.');
    const actions = c.actions.map((a, i) => (i === index ? { ...a, done: !a.done } : a));
    const [row] = await this.db.update(cases).set({ actions }).where(and(eq(cases.id, id), eq(cases.schoolId, schoolId))).returning();
    return toState(row!);
  }

  /** On ne peut clore un dossier sans plan d'action. */
  async toClose(id: string, schoolId: string) {
    const c = await this.get(id, schoolId);
    if (c.step === 3 && !c.actions.length) throw new BadRequestException('Ajoutez au moins une action avant la clôture.');
    return this.transition(id, schoolId, 3, { step: 4 });
  }

  close(id: string, schoolId: string, input: z.infer<typeof caseCloseSchema>) {
    return this.transition(id, schoolId, 4, { step: 5, summary: input.summary, log: logEntry('Signalement clos avec l’accord de la directrice') as never });
  }
}
