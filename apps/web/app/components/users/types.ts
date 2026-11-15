import type { ClassRow, LinkRequestRow, StudentRow, TeacherRow } from '~/lib/types';

/** Données de la page « Utilisateurs » (renvoyées par le chargeur de la route). */
export interface UsersData {
  tab: 'eleves' | 'profs' | 'ratt';
  students: StudentRow[];
  teachers: TeacherRow[];
  requests: LinkRequestRow[];
  classes: ClassRow[];
  /** La formule inclut les SMS (invitations, codes). */
  sms: boolean;
  selected: StudentRow | undefined;
  /** Demandes de rattachement en attente de décision. */
  pending: number;
}
