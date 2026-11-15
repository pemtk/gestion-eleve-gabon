/** État d'un signalement confidentiel tel que le renvoie l'API. */
export interface CaseState {
  /** 1 reçu · 2 accusé · 3 évaluation et plan d'action · 4 prêt à clore · 5 clos. */
  step: 1 | 2 | 3 | 4 | 5;
  gravity?: string;
  actions: CaseAction[];
  log: { at: string; event: string }[];
}

export interface CaseAction {
  label: string;
  owner: string;
  due: string;
  done: boolean;
}

export interface EvaluationValues {
  gravity: string;
  measures: string;
  informDirector: boolean;
  informFamily: boolean;
}
