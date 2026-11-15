import type { Plan, TaskType, AttendanceStatus } from './validation.js';
import type { Role } from './roles.js';

export interface SessionUser {
  id: string;
  name: string;
  initials: string;
  phone: string;
  role: Role;
  /** Libellé affiché sous le nom (ex. « Direction · Lycée Léon Mba »). */
  title: string;
  organization?: string;
  /** Établissement de rattachement (absent pour agent, partenaire et administrateur). */
  schoolId?: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  classId: string;
  phone: string | null;
  /** Code d'invitation parent à 6 chiffres. */
  code: string;
  parents: { name: string; relation: string }[];
  activated: boolean;
  smsSent?: boolean;
}

export interface SchoolClass {
  id: string;
  name: string;
  level: 'Primaire' | 'Collège' | 'Lycée';
  capacity: number;
  students: number;
  completion: number;
  alert?: string;
}

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  assignments: string;
  status: 'Activé' | 'Invitation envoyée' | 'Invitation expirée';
}

export type TaskStatus = 'todo' | 'doing' | 'done';
export interface Task {
  id: string;
  title: string;
  subject: string;
  type: TaskType;
  due: string;
  status: TaskStatus;
  estimate: string;
}

export interface GradeNote {
  label: string;
  value: number;
  meta: string;
  comment: string;
}
export interface SubjectGrades {
  subject: string;
  average: number;
  coefficient: number;
  notes: GradeNote[];
}

export interface Kpi {
  label: string;
  value: string;
  unit: string;
  sub: string;
  icon: string;
}
export interface BarRow {
  label: string;
  /** Pourcentage 0–100 (0 si masqué). */
  pct: number;
  display?: string;
}
export interface SideItem {
  icon: string;
  title: string;
  text: string;
  cta: string;
  highlight?: boolean;
}
export interface DashboardData {
  head: { kicker: string; title: string; action: string; actionIcon: string; toast: string; filters: { icon: string; label: string }[] };
  kpis: Kpi[];
  chart: { title: string; sub: string; legendA: string; legendB: string; rows: BarRow[] };
  side: { title: string; items: SideItem[] };
  table: { title: string; note: string; columns: string; head: string[]; rows: string[][] };
}

export interface NavItem {
  icon: string;
  label: string;
  badge?: string;
  to: string;
}

export interface ThreadSummary {
  id: string;
  initials: string;
  name: string;
  kind: string;
  last: string;
  time: string;
  unread: number;
  icon?: string;
  /** Groupe (classe, équipe) ou conversation à deux ; l'utilisateur peut-il y écrire (fil de classe réservé à l'enseignant, par exemple) ? */
  group?: boolean;
  canPost?: boolean;
}
export interface Message {
  /** Identifiant client (idempotence de l'envoi hors ligne). */
  id: string;
  /** Rang du message dans le fil : curseur d'actualisation et de lecture. */
  seq?: number;
  mine: boolean;
  text: string | null;
  image?: boolean;
  /** Image jointe (fichier de l'usage « message »). */
  fileId?: string;
  /** Auteur, pour les fils de groupe. */
  sender?: string;
  time: string;
  /** Hors ligne : l'envoi est en attente. */
  pending?: boolean;
}
/** Personne que l'on peut écrire (`POST /threads`) ; la clé est opaque. */
export interface Contact {
  key: string;
  name: string;
  label: string;
  initials: string;
}

export interface NotificationItem {
  id: string;
  icon: string;
  text: string;
  when: string;
  target: string;
  read: boolean;
}

export interface Reward {
  id: string;
  label: string;
  threshold: number;
}

export interface Badge {
  icon: string;
  label: string;
  earned: boolean;
}

export interface ConfidentialCase {
  id: string;
  reporter: string;
  className: string;
  type: string;
  received: string;
  student: string;
  text: string;
}

export interface TechIncident {
  id: string;
  icon: string;
  title: string;
  when: string;
  tone: 'hi' | 'warn' | 'n';
  status: 'En cours' | 'Surveillance' | 'Résolu';
  meta: string;
  description: string;
  table: string[][];
  action: string;
  actionIcon: string;
}

export const PROVINCE_NAMES = ['Estuaire', 'Haut-Ogooué', 'Ogooué-Maritime', 'Woleu-Ntem', 'Ngounié', 'Moyen-Ogooué', 'Nyanga', 'Ogooué-Ivindo', 'Ogooué-Lolo'] as const;
export type Province = (typeof PROVINCE_NAMES)[number];
export const SCHOOL_LEVELS = ['Primaire', 'Collège', 'Lycée'] as const;
export type SchoolLevel = (typeof SCHOOL_LEVELS)[number];

export interface Organization {
  id: string;
  name: string;
  type: 'École' | 'Diocèse' | 'Réseau';
  plan: Plan;
  status: string;
  due: string;
  parentId?: string;
  /** Province (écoles) : sert aux indicateurs par région du partenaire. */
  province?: Province;
  level?: SchoolLevel;
}

export type { AttendanceStatus };
