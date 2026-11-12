import { Injectable } from '@nestjs/common';
import {
  ABSENCES, ASSIGNMENTS, ALERT_PREFS, CLASSES, CONFIDENTIAL_CASES, CONVERSATION, DEMO_PASSWORD,
  DEMO_USERS, LINK_REQUESTS, NOTIFICATIONS, ORGANIZATIONS, REWARDS, SCHOOL_YEAR, STUDENT_START,
  STUDENTS, SUBJECT_GRADES, TASKS, TEACHERS, TECH_INCIDENTS, THREADS, VISIT_REPORTS, AGENT_USERS,
  type Message, type Plan, type SessionUser,
} from '@sge/shared';
import { hashPassword } from '../auth/password.js';

export interface UserRecord {
  user: SessionUser;
  passwordHash: string;
  activated: boolean;
}

export interface CaseAction { label: string; owner: string; due: string; done: boolean }
export interface CaseState {
  id: string;
  /** 1 accusé · 2 évaluation · 3 plan d'action · 4 clôture · 5 clos */
  step: 1 | 2 | 3 | 4 | 5;
  gravity?: string;
  measures: string;
  informDirector: boolean;
  informFamily: boolean;
  actions: CaseAction[];
  summary?: string;
  log: { at: string; event: string }[];
}

/**
 * Persistance en mémoire alimentée par les données de démonstration.
 * C'est le seul endroit à remplacer par une base de données (voir README, « Persistance »).
 */
@Injectable()
export class StoreService {
  readonly users = new Map<string, UserRecord>();
  readonly otps = new Map<string, { code: string; expires: number; attempts: number }>();

  students = structuredClone(STUDENTS);
  classes = structuredClone(CLASSES);
  teachers = structuredClone(TEACHERS);
  linkRequests = LINK_REQUESTS.map((r) => ({ ...r, decision: null as null | 'ok' | 'no' }));
  year = structuredClone(SCHOOL_YEAR);
  years = [structuredClone(SCHOOL_YEAR)];
  assignments = structuredClone(ASSIGNMENTS);
  absences = structuredClone(ABSENCES);
  cases = new Map<string, CaseState>();
  announcements: { id: string; title: string; message: string; audience: string; target?: string; at: string }[] = [];
  results = [
    ['Aïcha Ondo', 15.5], ['Brice Nzé', 12], ['Cyrielle Mba', 17], ['Daniel Obiang', null], ['Emmanuella Moussavou', 9.5], ['Fabrice Mintsa', 13],
  ].map(([student, value], i) => ({ id: `res${i}`, student: student as string, value: value as number | null, coefficient: 2, comment: '', published: value !== null, history: [] as { from: number; to: number; reason: string; at: string }[] }));
  referent: { name: string; confirmed: boolean } | null = { name: 'Rosine Mba', confirmed: true };
  gradeCorrections: { subject: string; label: string; from: number; to: number; reason: string; at: string }[] = [];
  subjectGrades = structuredClone(SUBJECT_GRADES);
  subscription: { plan: Plan; suspended: boolean; requestedPlan: Plan | null } = { plan: 'Standard', suspended: false, requestedPlan: null };

  tasks = structuredClone(TASKS);
  invalidated = new Set<number>();
  learner = { ...STUDENT_START, history: [] as { label: string; when: string; points: string }[] };
  rewards = structuredClone(REWARDS);
  alertPrefs = structuredClone(ALERT_PREFS);
  notificationsRead = new Set<string>();
  threads = structuredClone(THREADS);
  conversations = new Map<string, Message[]>();
  notifications = NOTIFICATIONS;
  photoVisibility: 'school' | 'teachers' | 'private' = 'school';

  organizations = structuredClone(ORGANIZATIONS);
  subscriptions = new Map<string, { plan: Plan; period: 'mensuelle' | 'annuelle'; active: boolean }>();
  agentUsers = structuredClone(AGENT_USERS);
  incidents = structuredClone(TECH_INCIDENTS);
  visitReports = structuredClone(VISIT_REPORTS);

  constructor() {
    const hash = hashPassword(DEMO_PASSWORD);
    for (const user of Object.values(DEMO_USERS)) {
      this.users.set(user.phone, { user, passwordHash: hash, activated: true });
    }
    for (const c of CONFIDENTIAL_CASES) {
      this.cases.set(c.id, { id: c.id, step: 1, measures: '', informDirector: false, informFamily: false, actions: [], log: [] });
    }
    this.conversations.set('default', structuredClone(CONVERSATION));
    for (const o of this.organizations) this.subscriptions.set(o.id, { plan: o.plan, period: 'annuelle', active: o.status !== 'Suspendu' });
  }
}
