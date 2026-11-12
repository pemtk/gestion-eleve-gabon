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
 */
@Injectable()
export class CasesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  private async get(id: string): Promise<CaseRow> {
    const [row] = await this.db.select().from(cases).where(eq(cases.id, id));
    if (!row) throw new NotFoundException('Signalement introuvable.');
    return row;
  }

  async list() {
    return (await this.db.select().from(cases).orderBy(cases.id)).map((c) => ({ ...toInfo(c), step: c.step }));
  }

  async detail(id: string) {
    const c = await this.get(id);
    return { info: toInfo(c), state: toState(c) };
  }

  private async transition(id: string, from: number, set: Partial<typeof cases.$inferInsert>) {
    await this.get(id);
    const [row] = await this.db.update(cases).set(set).where(and(eq(cases.id, id), eq(cases.step, from))).returning();
    if (!row) throw new BadRequestException('Cette étape n’est pas disponible pour ce dossier.');
    return toState(row);
  }

  acknowledge(id: string) {
    return this.transition(id, 1, { step: 2, log: logEntry('Accusé de réception · l’auteur est informé') as never });
  }

  evaluate(id: string, input: z.infer<typeof caseEvaluationSchema>) {
    const event = `Évaluation : gravité ${input.gravity.toLowerCase()}${input.informDirector ? ' · directrice informée' : ''}${input.informFamily ? ' · famille prévenue' : ''}`;
    return this.transition(id, 2, { step: 3, gravity: input.gravity, measures: input.measures, informDirector: input.informDirector, informFamily: input.informFamily, log: logEntry(event) as never });
  }

  async addAction(id: string, label: string, owner: string) {
    const action = { label, owner, due: 'sous 7 j', done: false };
    const [row] = await this.db.update(cases).set({ actions: sql`${cases.actions} || ${JSON.stringify([action])}::jsonb` as never, log: logEntry(`Action ajoutée : ${label}`) as never }).where(and(eq(cases.id, id), eq(cases.step, 3))).returning();
    if (!row) { await this.get(id); throw new BadRequestException('Cette étape n’est pas disponible pour ce dossier.'); }
    return toState(row);
  }

  async toggleAction(id: string, index: number) {
    const c = await this.get(id);
    if (!c.actions[index]) throw new NotFoundException('Action introuvable.');
    const actions = c.actions.map((a, i) => (i === index ? { ...a, done: !a.done } : a));
    const [row] = await this.db.update(cases).set({ actions }).where(eq(cases.id, id)).returning();
    return toState(row!);
  }

  /** On ne peut clore un dossier sans plan d'action. */
  async toClose(id: string) {
    const c = await this.get(id);
    if (c.step === 3 && !c.actions.length) throw new BadRequestException('Ajoutez au moins une action avant la clôture.');
    return this.transition(id, 3, { step: 4 });
  }

  close(id: string, input: z.infer<typeof caseCloseSchema>) {
    return this.transition(id, 4, { step: 5, summary: input.summary, log: logEntry('Signalement clos avec l’accord de la directrice') as never });
  }
}
