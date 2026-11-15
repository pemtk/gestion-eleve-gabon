import type { TaskType } from '@sge/shared';

/** Aide contextuelle selon le type de tâche : ce que l'élève devra faire et ce qui est demandé. */
export const TASK_HELP: Record<
  TaskType,
  { hint: string; icon: string; description: string; due: string; estimate: string }
> = {
  Cours: {
    hint: 'Support à lire ou à regarder. L’élève le marque comme lu ; ni note ni preuve demandée.',
    icon: 'book-open',
    description: 'Résumé du cours',
    due: 'À lire avant',
    estimate: 'Temps de lecture',
  },
  Exercice: {
    hint: 'Exercices à faire. L’élève s’auto-évalue ; une photo du cahier peut être demandée.',
    icon: 'pencil',
    description: 'Consigne',
    due: 'À rendre pour',
    estimate: 'Temps estimé',
  },
  Devoir: {
    hint: 'Travail noté. La photo peut être obligatoire et la note ajoutée au bulletin.',
    icon: 'clipboard-check',
    description: 'Consigne',
    due: 'À rendre pour',
    estimate: 'Temps estimé',
  },
};

export const DUE_CHOICES = ['Aujourd’hui', 'Demain', 'Vendredi', 'Lundi'];
export const ESTIMATE_CHOICES = ['15 min', '30 min', '45 min', '60 min'];
