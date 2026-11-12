import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CONFIDENTIAL_CASES, type ConfidentialCase, type caseCloseSchema, type caseEvaluationSchema } from '@sge/shared';
import type { z } from 'zod';
import { StoreService, type CaseState } from '../common/store.service.js';

const now = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * Traitement d'un signalement confidentiel (§11.2) :
 * accusé de réception (4 h) → première évaluation (24 h) → plan d'action → clôture avec la directrice.
 */
@Injectable()
export class CasesService {
  constructor(private readonly store: StoreService) {}

  private get(id: string): CaseState {
    const state = this.store.cases.get(id);
    if (!state) throw new NotFoundException('Signalement introuvable.');
    return state;
  }

  list() {
    return CONFIDENTIAL_CASES.map((c) => ({ ...c, step: this.get(c.id).step }));
  }

  detail(id: string): { info: ConfidentialCase; state: CaseState } {
    const info = CONFIDENTIAL_CASES.find((c) => c.id === id);
    if (!info) throw new NotFoundException('Signalement introuvable.');
    return { info, state: this.get(id) };
  }

  private expect(state: CaseState, step: CaseState['step']) {
    if (state.step !== step) throw new BadRequestException('Cette étape n’est pas disponible pour ce dossier.');
  }

  acknowledge(id: string) {
    const s = this.get(id);
    this.expect(s, 1);
    s.step = 2;
    s.log.push({ at: now(), event: 'Accusé de réception · l’auteur est informé' });
    return s;
  }

  evaluate(id: string, input: z.infer<typeof caseEvaluationSchema>) {
    const s = this.get(id);
    this.expect(s, 2);
    s.gravity = input.gravity;
    s.measures = input.measures;
    s.informDirector = input.informDirector;
    s.informFamily = input.informFamily;
    s.step = 3;
    s.log.push({
      at: now(),
      event: `Évaluation : gravité ${input.gravity.toLowerCase()}${input.informDirector ? ' · directrice informée' : ''}${input.informFamily ? ' · famille prévenue' : ''}`,
    });
    return s;
  }

  addAction(id: string, label: string, owner: string) {
    const s = this.get(id);
    this.expect(s, 3);
    s.actions.push({ label, owner, due: 'sous 7 j', done: false });
    s.log.push({ at: now(), event: `Action ajoutée : ${label}` });
    return s;
  }

  toggleAction(id: string, index: number) {
    const s = this.get(id);
    const action = s.actions[index];
    if (!action) throw new NotFoundException('Action introuvable.');
    action.done = !action.done;
    return s;
  }

  /** On ne peut clore un dossier sans plan d'action. */
  toClose(id: string) {
    const s = this.get(id);
    this.expect(s, 3);
    if (!s.actions.length) throw new BadRequestException('Ajoutez au moins une action avant la clôture.');
    s.step = 4;
    return s;
  }

  close(id: string, input: z.infer<typeof caseCloseSchema>) {
    const s = this.get(id);
    this.expect(s, 4);
    s.summary = input.summary;
    s.step = 5;
    s.log.push({ at: now(), event: 'Signalement clos avec l’accord de la directrice' });
    return s;
  }
}
