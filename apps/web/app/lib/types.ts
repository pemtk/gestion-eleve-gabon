import type { AttendanceStatus, Student, Teacher } from '@sge/shared';

export type StudentRow = Student & { className: string; codeLabel: string; initials: string };
export type TeacherRow = Teacher;
export type LinkRequestRow = { id: string; parent: string; relation: string; child: string; meta: string; decision: null | 'ok' | 'no' };
export type ClassRow = { id: string; name: string; level: string; capacity: number; students: number; completion: number };
export type AbsenceRow = { id: string; studentId: string; student: string; className: string; date: string; dateLabel: string; status: AttendanceStatus; justification: string | null };
export type SubscriptionInfo = {
  plan: import('@sge/shared').Plan; suspended: boolean; requestedPlan: import('@sge/shared').Plan | null;
  features: { sms: boolean; stats: boolean; network: boolean; diocese: boolean };
  included: string[]; missing: { label: string; needs: string }[]; price: number; dueDate: string;
  plans: { plan: import('@sge/shared').Plan; price: number; current: boolean; requested: boolean; upgrade: boolean }[];
};
