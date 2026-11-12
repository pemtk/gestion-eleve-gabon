import { z } from 'zod';

/** Seuil de confidentialité : une cellule de moins de 10 individus est masquée (§9.2). */
export const PRIVACY_THRESHOLD = 10;

export function maskSmallCell(count: number): number | null {
  return count < PRIVACY_THRESHOLD ? null : count;
}

export interface PasswordRule {
  key: 'length' | 'digit' | 'letter';
  label: string;
  ok: boolean;
}

/** Règles du mot de passe (§2.1) : 8 caractères minimum, dont un chiffre et une lettre. */
export function passwordRules(password: string): PasswordRule[] {
  return [
    { key: 'length', label: '8 caractères minimum', ok: password.length >= 8 },
    { key: 'digit', label: 'Au moins un chiffre', ok: /\d/.test(password) },
    { key: 'letter', label: 'Au moins une lettre', ok: /[a-zA-Z]/.test(password) },
  ];
}
export const isPasswordValid = (password: string) => passwordRules(password).every((r) => r.ok);

/** Numéro gabonais : indicatif +241, 8 chiffres minimum (7 ou 8 selon l'opérateur). */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^(00)?241/, '');
  return digits;
}
export function formatPhone(input: string): string {
  const d = normalizePhone(input);
  return d.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((d) => d.length >= 8 && d.length <= 9, 'Numéro de téléphone invalide (format +241…)');

export const passwordSchema = z.string().refine(isPasswordValid, 'Mot de passe trop faible');

export const loginSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('password'), phone: phoneSchema, password: z.string().min(1) }),
  z.object({ mode: z.literal('otp'), phone: phoneSchema }),
]);

export const otpVerifySchema = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/) });

export const signupSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: phoneSchema,
  email: z.email().optional().or(z.literal('')),
  password: passwordSchema,
});

export const forgotSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/).optional(),
  password: passwordSchema.optional(),
});

/** Définir un mot de passe quand le compte n'en a pas encore (compte créé par l'école, activé par SMS). */
export const passwordSetSchema = z
  .object({ next: passwordSchema, confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ['confirm'], message: 'Les deux mots de passe ne sont pas identiques.' });

export const passwordChangeSchema = z
  .object({ current: z.string().min(1), next: passwordSchema, confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ['confirm'], message: 'Les deux mots de passe ne sont pas identiques.' });

export const TASK_TYPES = ['Cours', 'Exercice', 'Devoir'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const taskInputSchema = z.object({
  classId: z.string(),
  subject: z.string().min(1),
  type: z.enum(TASK_TYPES),
  title: z.string().trim().min(1, 'Le titre est obligatoire.'),
  description: z.string().default(''),
  due: z.string().min(1),
  estimateMinutes: z.number().int().positive().optional(),
  attachment: z.string().optional(),
  requirePhoto: z.boolean().default(false),
  graded: z.boolean().default(false),
  coefficient: z.number().positive().optional(),
});

export const selfEvaluationSchema = z.object({
  taskId: z.string(),
  evaluation: z.enum(['ok', 'doubt']),
  proof: z.boolean().default(false),
  seconds: z.number().int().nonnegative(),
});

export const gradeInputSchema = z.object({
  classId: z.string(),
  subject: z.string(),
  trimester: z.enum(['T1', 'T2', 'T3']),
  label: z.string().min(1),
  coefficient: z.number().positive(),
  entries: z.array(
    z.object({
      studentId: z.string(),
      value: z.number().min(0).max(20),
      comment: z.string().default(''),
    }),
  ),
});

export const gradeCorrectionSchema = z.object({
  value: z.number().min(0).max(20),
  reason: z.string().trim().min(3, 'Le motif est obligatoire.'),
});

export const ATTENDANCE_STATUSES = ['P', 'A', 'R'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const JUSTIFICATIONS = ['Maladie', 'Raison familiale', 'Transport', 'Autre'] as const;

export const attendanceSchema = z.object({
  classId: z.string(),
  /** Jour de l'appel au format ISO (AAAA-MM-JJ). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ).'),
  entries: z.array(
    z.object({
      studentId: z.string(),
      status: z.enum(ATTENDANCE_STATUSES),
      justification: z.enum(JUSTIFICATIONS).optional(),
    }),
  ),
});

export const announcementSchema = z.object({
  title: z.string().trim().optional(),
  message: z.string().trim().min(1),
  audience: z.enum(['school', 'level', 'class', 'teachers', 'parents']),
  target: z.string().optional(),
  attachment: z.string().optional(),
});

export const REPORT_KINDS = ['conduite', 'confidentiel'] as const;
export const reportInputSchema = z.object({
  studentId: z.string(),
  kind: z.enum(REPORT_KINDS),
  description: z.string().trim().min(1),
});

export const newStudentSchema = z.object({
  lastName: z.string().trim().min(1),
  firstName: z.string().trim().min(1),
  phone: phoneSchema,
  classId: z.string(),
});

export const inviteSchema = z.object({
  name: z.string().trim().min(1),
  phone: phoneSchema,
  role: z.enum(['enseignant', 'agent', 'partenaire']).default('enseignant'),
  scopes: z.array(z.string()).default([]),
});

export const linkChildSchema = z.object({
  mode: z.enum(['code', 'qr']),
  code: z.string().regex(/^\d{6}$/).optional(),
  relation: z.enum(['père', 'mère', 'tuteur', 'tutrice', 'autre']),
});

/** Responsable d'un établissement (compte de direction créé avec l'école, invité par SMS). */
export const directorSchema = z.object({ name: z.string().trim().min(1, 'Le nom de la direction est obligatoire.'), phone: phoneSchema });

export const organizationSchema = z.object({
  type: z.enum(['École', 'Diocèse', 'Réseau']),
  name: z.string().trim().min(1),
  address: z.string().default(''),
  phone: z.string().default(''),
  email: z.string().default(''),
  parentId: z.string().optional(),
  /** Direction de l'école : son compte est créé et invité par SMS. Sans objet pour un diocèse ou un réseau. */
  director: directorSchema.optional(),
});

/** Premier administrateur de la plateforme (commande `admin:create`). */
export const platformAdminSchema = z.object({ name: z.string().trim().min(1), phone: phoneSchema, password: passwordSchema });

export const PLANS = ['Essentiel', 'Standard', 'Réseau', 'Diocésain'] as const;
export type Plan = (typeof PLANS)[number];
export const subscriptionSchema = z.object({
  plan: z.enum(PLANS),
  period: z.enum(['mensuelle', 'annuelle']),
  start: z.string(),
  end: z.string(),
  active: z.boolean(),
});

export const visitReportSchema = z.object({
  schoolId: z.string(),
  date: z.string(),
  observations: z.string().trim().min(1),
  attachment: z.string().optional(),
  visibleToSchool: z.boolean().default(false),
});

export const rewardSchema = z.object({ label: z.string().trim().min(1), threshold: z.number().int().positive() });

export const schoolYearSchema = z.object({
  label: z.string().trim().min(1),
  start: z.string(),
  end: z.string(),
  terms: z.array(z.object({ name: z.string(), start: z.string(), end: z.string(), coefficient: z.number().positive() })),
});

export const classInputSchema = z.object({
  level: z.enum(['Primaire', 'Collège', 'Lycée']),
  name: z.string().trim().min(1),
  capacity: z.number().int().positive(),
});

/** Prochain état d'un signalement confidentiel (§11.2) : accusé → évaluation → plan d'action → clôture. */
export const CASE_STEPS = ['Accusé de réception', 'Première évaluation', 'Plan d’action', 'Clôture'] as const;
export const caseEvaluationSchema = z.object({
  gravity: z.enum(['Faible', 'Modérée', 'Élevée']),
  measures: z.string().default(''),
  informDirector: z.boolean().default(false),
  informFamily: z.boolean().default(false),
});
export const caseCloseSchema = z.object({ summary: z.string().trim().min(1), directorAgreement: z.literal(true) });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type GradeInput = z.infer<typeof gradeInputSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
