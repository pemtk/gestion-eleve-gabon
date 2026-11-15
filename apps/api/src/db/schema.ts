import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/* ============================== Comptes et sécurité ============================== */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    phone: text('phone').notNull().unique(),
    name: text('name').notNull(),
    initials: text('initials').notNull(),
    role: text('role').notNull(),
    title: text('title').notNull().default(''),
    organization: text('organization'),
    /** Null tant que le titulaire n'a pas défini de mot de passe (compte créé par l'école, activé par code SMS). */
    passwordHash: text('password_hash'),
    activated: boolean('activated').notNull().default(false),
    /** Établissement de rattachement (null pour agent, partenaire et administrateur : profils multi-établissements). */
    schoolId: text('school_id').references(() => organizations.id),
    photoVisibility: text('photo_visibility').notNull().default('school'),
    /** Photo de profil (table `files`) ; sa visibilité suit `photoVisibility`. */
    avatarFileId: text('avatar_file_id'),
  },
  (t) => [index('users_school_idx').on(t.schoolId)],
);

export const otpCodes = pgTable('otp_codes', {
  phone: text('phone').primaryKey(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
});

/** Compteurs de limitation de débit (connexion, codes SMS) : en base pour rester valables avec plusieurs instances. */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true })
    .notNull()
    .defaultNow(),
  blockedUntil: timestamp('blocked_until', { withTimezone: true }),
});

/**
 * Jetons de renouvellement (opaques, stockés hachés). Chaque renouvellement remplace le précédent ; la réutilisation d'un jeton
 * déjà remplacé révoque toute la famille (vol probable). Une famille expire au bout de 30 jours quoi qu'il arrive.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: text('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    familyStartedAt: timestamp('family_started_at', {
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedBy: text('replaced_by'),
  },
  (t) => [
    index('refresh_tokens_user_idx').on(t.userId),
    index('refresh_tokens_family_idx').on(t.familyId),
  ],
);

/** Journal d'audit : accès et actions sensibles (signalements confidentiels, sécurité des comptes). Jamais modifié ni purgé par l'application. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    schoolId: text('school_id'),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    /** « ok » ou « refuse » (ressource introuvable ou d'une autre école, droits insuffisants). */
    outcome: text('outcome').notNull().default('ok'),
    ip: text('ip'),
    details: jsonb('details'),
  },
  (t) => [
    index('audit_log_school_idx').on(t.schoolId, t.at),
    index('audit_log_resource_idx').on(t.resourceType, t.resourceId),
  ],
);

/**
 * Fichiers téléversés (octets dans le stockage objet, métadonnées ici). Un fichier est « pending » jusqu'à ce qu'un objet le réclame
 * (preuve d'une tâche, annonce, compte-rendu, photo de profil, message) : les orphelins sont purgés. L'accès se décide à la lecture,
 * d'après l'objet auquel il est rattaché (`ref_type`, `ref_id`), jamais d'après une URL devinable.
 */
export const files = pgTable(
  'files',
  {
    id: text('id').primaryKey(),
    /** Établissement du fichier ; null pour un compte sans école (parent, administrateur) tant qu'il n'est rattaché à aucune. */
    schoolId: text('school_id').references(() => organizations.id),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    status: text('status').notNull().default('pending'),
    refType: text('ref_type'),
    refId: text('ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('files_owner_idx').on(t.ownerId),
    index('files_school_idx').on(t.schoolId),
    index('files_pending_idx').on(t.status, t.createdAt),
  ],
);

/** Réglages clé/valeur : abonnement de l'école, référent vie scolaire, visibilité des photos. */
/** Réglages par établissement (référent vie scolaire…). */
export const settings = pgTable(
  'settings',
  {
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.schoolId, t.key] })],
);

/* ============================== Établissement ============================== */
export const classes = pgTable(
  'classes',
  {
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    level: text('level').notNull(),
    capacity: integer('capacity').notNull(),
    /** Effectif affiché (les élèves non encore importés y sont comptés). */
    studentCount: integer('student_count').notNull().default(0),
    completion: integer('completion').notNull().default(0),
    alert: text('alert'),
  },
  (t) => [
    uniqueIndex('classes_school_name_uq').on(t.schoolId, t.name),
    unique('classes_id_school_uq').on(t.id, t.schoolId),
  ],
);

export const students = pgTable(
  'students',
  {
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    classId: text('class_id').notNull(),
    /** Compte de l'élève, une fois activé (ses points et son temps de travail y sont rattachés). */
    userId: text('user_id')
      .references(() => users.id)
      .unique(),
    phone: text('phone'),
    /** Code d'invitation parent (6 chiffres). */
    code: text('code').notNull().unique(),
    activated: boolean('activated').notNull().default(false),
    smsSent: boolean('sms_sent').notNull().default(false),
  },
  (t) => [
    index('students_school_idx').on(t.schoolId),
    // La classe d'un élève doit appartenir à la même école que l'élève (garantie assurée par la base).
    foreignKey({
      columns: [t.classId, t.schoolId],
      foreignColumns: [classes.id, classes.schoolId],
      name: 'students_class_same_school_fk',
    }),
  ],
);

export const studentParents = pgTable(
  'student_parents',
  {
    id: serial('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    relation: text('relation').notNull(),
    /** Compte du parent ; null tant que ce parent n'a pas d'application. */
    parentUserId: text('parent_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
  },
  (t) => [
    uniqueIndex('student_parents_student_user_uq').on(
      t.studentId,
      t.parentUserId,
    ),
  ],
);

export const teachers = pgTable(
  'teachers',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    /** Compte de l'enseignant, une fois activé. */
    userId: text('user_id')
      .references(() => users.id)
      .unique(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    status: text('status').notNull(),
  },
  (t) => [
    index('teachers_school_idx').on(t.schoolId),
    unique('teachers_id_school_uq').on(t.id, t.schoolId),
  ],
);

export const linkRequests = pgTable('link_requests', {
  schoolId: text('school_id')
    .notNull()
    .references(() => organizations.id),
  id: text('id').primaryKey(),
  parent: text('parent').notNull(),
  relation: text('relation').notNull(),
  child: text('child').notNull(),
  meta: text('meta').notNull(),
  /** Élève et compte parent concernés : à la validation par l'école, le rattachement est créé. */
  studentId: text('student_id'),
  parentUserId: text('parent_user_id'),
  decision: text('decision'),
});

export const schoolYears = pgTable('school_years', {
  schoolId: text('school_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  start: text('start').notNull(),
  end: text('end').notNull(),
  active: boolean('active').notNull().default(false),
  terms: jsonb('terms')
    .$type<
      { name: string; start: string; end: string; coefficient: number }[]
    >()
    .notNull(),
});

/** Affectation : un enseignant enseigne une matière dans une classe (de la même école, garanti par la base). */
export const assignments = pgTable(
  'assignments',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    teacherId: text('teacher_id').notNull(),
    classId: text('class_id').notNull(),
    subject: text('subject').notNull(),
    year: text('year').notNull(),
    principal: boolean('principal').notNull().default(false),
  },
  (t) => [
    uniqueIndex('assignments_teacher_class_subject_uq').on(
      t.teacherId,
      t.classId,
      t.subject,
    ),
    foreignKey({
      columns: [t.teacherId, t.schoolId],
      foreignColumns: [teachers.id, teachers.schoolId],
      name: 'assignments_teacher_same_school_fk',
    }),
    foreignKey({
      columns: [t.classId, t.schoolId],
      foreignColumns: [classes.id, classes.schoolId],
      name: 'assignments_class_same_school_fk',
    }),
  ],
);

/** Évaluation (interrogation, devoir…) donnée à une classe dans une matière et un trimestre. */
export const evaluations = pgTable(
  'evaluations',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    classId: text('class_id').notNull(),
    subject: text('subject').notNull(),
    trimester: text('trimester').notNull(),
    label: text('label').notNull(),
    coefficient: integer('coefficient').notNull().default(1),
    /** Date de l'évaluation (ISO). */
    heldOn: text('held_on').notNull(),
    teacherId: text('teacher_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('evaluations_class_subject_term_label_uq').on(
      t.classId,
      t.subject,
      t.trimester,
      t.label,
    ),
    index('evaluations_school_idx').on(t.schoolId),
    foreignKey({
      columns: [t.classId, t.schoolId],
      foreignColumns: [classes.id, classes.schoolId],
      name: 'evaluations_class_same_school_fk',
    }),
  ],
);

/** Note d'un élève à une évaluation (publiée dès qu'elle existe ; corrigée par l'école avec motif). */
export const grades = pgTable(
  'grades',
  {
    id: serial('id').primaryKey(),
    evaluationId: text('evaluation_id')
      .notNull()
      .references(() => evaluations.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    value: real('value').notNull(),
    comment: text('comment').notNull().default(''),
  },
  (t) => [
    uniqueIndex('grades_evaluation_student_uq').on(t.evaluationId, t.studentId),
  ],
);

/** Coefficient de chaque matière dans la moyenne générale (propre à l'école). */
export const schoolSubjects = pgTable(
  'school_subjects',
  {
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    coefficient: integer('coefficient').notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.schoolId, t.name] })],
);

export const gradeCorrections = pgTable('grade_corrections', {
  id: serial('id').primaryKey(),
  gradeId: integer('grade_id')
    .notNull()
    .references(() => grades.id, { onDelete: 'cascade' }),
  fromValue: real('from_value').notNull(),
  toValue: real('to_value').notNull(),
  reason: text('reason').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

export const announcements = pgTable('announcements', {
  schoolId: text('school_id')
    .notNull()
    .references(() => organizations.id),
  id: text('id').primaryKey(),
  title: text('title').notNull().default(''),
  message: text('message').notNull(),
  audience: text('audience').notNull(),
  target: text('target'),
  /** Auteur (enseignant) et classe visée, le cas échéant. */
  authorId: text('author_id'),
  classId: text('class_id'),
  attachmentFileId: text('attachment_file_id'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

/** Signalements confidentiels et leur avancement (accusé → évaluation → plan d'action → clôture). */
/** Numérotation des dossiers : SC-0300, SC-0301… */
export const caseNumberSeq = pgSequence('case_number_seq', { startWith: 300 });

export const cases = pgTable(
  'cases',
  {
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').primaryKey(),
    reporter: text('reporter').notNull(),
    className: text('class_name').notNull(),
    type: text('type').notNull(),
    received: text('received').notNull(),
    student: text('student').notNull(),
    studentId: text('student_id'),
    reporterId: text('reporter_id'),
    /** « confidentiel » : traité par le référent ; « conduite » : visible de l'école. */
    kind: text('kind').notNull().default('confidentiel'),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    step: integer('step').notNull().default(1),
    gravity: text('gravity'),
    measures: text('measures').notNull().default(''),
    informDirector: boolean('inform_director').notNull().default(false),
    informFamily: boolean('inform_family').notNull().default(false),
    summary: text('summary'),
    actions: jsonb('actions')
      .$type<{ label: string; owner: string; due: string; done: boolean }[]>()
      .notNull()
      .default([]),
    log: jsonb('log')
      .$type<{ at: string; event: string }[]>()
      .notNull()
      .default([]),
  },
  (t) => [index('cases_school_idx').on(t.schoolId)],
);

/* ============================== Élève, parent, enseignant ============================== */
export const tasks = pgTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    /** Classe destinataire : seuls ses élèves voient la tâche. */
    classId: text('class_id').notNull(),
    teacherId: text('teacher_id'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    subject: text('subject').notNull(),
    type: text('type').notNull(),
    due: text('due').notNull(),
    estimate: text('estimate').notNull().default('—'),
    requirePhoto: boolean('require_photo').notNull().default(false),
    graded: boolean('graded').notNull().default(false),
    position: serial('position'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('tasks_school_idx').on(t.schoolId),
    index('tasks_class_idx').on(t.classId),
    foreignKey({
      columns: [t.classId, t.schoolId],
      foreignColumns: [classes.id, classes.schoolId],
      name: 'tasks_class_same_school_fk',
    }),
  ],
);

/** Avancement d'un élève sur une tâche : « doing », « done » ou « redo » (invalidée par l'enseignant). */
export const taskCompletions = pgTable(
  'task_completions',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    seconds: integer('seconds').notNull().default(0),
    evaluation: text('evaluation'),
    proof: boolean('proof').notNull().default(false),
    /** Photo de preuve (table `files`), visible de l'enseignant de la classe et, selon le réglage de l'école, du parent. */
    proofFileId: text('proof_file_id'),
    /** Points accordés à la validation ; annulés si l'enseignant invalide. */
    points: integer('points').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.studentId] })],
);

export const learner = pgTable('learner', {
  userId: text('user_id').primaryKey(),
  points: integer('points').notNull(),
  streak: integer('streak').notNull(),
  doneToday: integer('done_today').notNull(),
  history: jsonb('history')
    .$type<{ label: string; when: string; points: string }[]>()
    .notNull()
    .default([]),
});

/** Temps de travail réel d'un élève (secondes chronométrées sur une tâche terminée). */
export const workSessions = pgTable(
  'work_sessions',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    seconds: integer('seconds').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('work_sessions_user_idx').on(t.userId, t.at)],
);

export const rewards = pgTable('rewards', {
  id: text('id').primaryKey(),
  /** Parent qui offre la récompense. */
  ownerId: text('owner_id').notNull(),
  label: text('label').notNull(),
  threshold: integer('threshold').notNull(),
});

export const alertPrefs = pgTable(
  'alert_prefs',
  {
    userId: text('user_id').notNull(),
    id: text('id').notNull(),
    label: text('label').notNull(),
    on: boolean('on').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

/** Appel : une ligne par élève, classe et jour. Source unique des absences et retards (vue de l'école comprise). */
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: serial('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    classId: text('class_id').notNull(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    /** Jour de l'appel, au format ISO (AAAA-MM-JJ). */
    date: text('date').notNull(),
    /** P présent, A absent, R en retard. */
    status: text('status').notNull(),
    justification: text('justification'),
    takenBy: text('taken_by'),
  },
  (t) => [
    uniqueIndex('attendance_class_date_student_uq').on(
      t.classId,
      t.date,
      t.studentId,
    ),
    index('attendance_school_date_idx').on(t.schoolId, t.date),
    foreignKey({
      columns: [t.classId, t.schoolId],
      foreignColumns: [classes.id, classes.schoolId],
      name: 'attendance_class_same_school_fk',
    }),
  ],
);

/* ============================== Messagerie ============================== */
/**
 * Une conversation : privée (deux personnes, ou un parent et l'administration de l'école), de classe (élèves ou parents) ou d'école (équipe).
 * Les droits ne sont jamais lus dans l'URL : ils se déduisent de l'appartenance (membres explicites pour le privé, classe et école pour les groupes).
 */
export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => organizations.id),
    /** private | class | school */
    kind: text('kind').notNull(),
    /** class : « students » ou « parents » ; private : « administration » pour un parent qui écrit à la direction. */
    audience: text('audience'),
    classId: text('class_id'),
    /** Une seule conversation par couple de personnes, par classe et audience, ou par école : la création est idempotente. */
    uniqueKey: text('unique_key').notNull().unique(),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  },
  (t) => [index('conversations_school_idx').on(t.schoolId, t.kind)],
);

/** Participants explicites : conversations privées uniquement (les groupes se déduisent de la classe ou de l'école). */
export const conversationMembers = pgTable(
  'conversation_members',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index('conversation_members_user_idx').on(t.userId),
  ],
);

/** Dernier message lu par chaque participant : les non-lus sont les messages des autres après ce curseur. */
export const conversationReads = pgTable(
  'conversation_reads',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastReadMessageId: integer('last_read_message_id').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] })],
);

export const conversationMessages = pgTable(
  'conversation_messages',
  {
    id: serial('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    /** Identifiant généré par l'appareil : rend l'envoi idempotent (file d'attente hors ligne). */
    clientId: text('client_id').notNull(),
    senderId: text('sender_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    senderRole: text('sender_role').notNull(),
    text: text('text'),
    /** Image jointe (table `files`, usage « message »). */
    fileId: text('file_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('conversation_messages_client_uq').on(
      t.conversationId,
      t.clientId,
    ),
    index('conversation_messages_conv_idx').on(t.conversationId, t.id),
  ],
);

export const notificationReads = pgTable(
  'notification_reads',
  {
    userId: text('user_id').notNull(),
    notificationId: text('notification_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.notificationId] })],
);

/* ============================== Agent, partenaire, administration ============================== */
/** Une organisation est une école, un diocèse ou un réseau ; une école est aussi le « tenant » de toutes les données scolaires. */
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  plan: text('plan').notNull(),
  status: text('status').notNull(),
  due: text('due').notNull().default(''),
  parentId: text('parent_id'),
  /** Province et niveau (écoles) : indicateurs par région du partenaire. */
  province: text('province'),
  level: text('level'),
});

export const orgSubscriptions = pgTable('org_subscriptions', {
  orgId: text('org_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull(),
  period: text('period').notNull().default('annuelle'),
  active: boolean('active').notNull().default(true),
  /** Formule demandée par l'établissement, en attente de validation. */
  requestedPlan: text('requested_plan'),
});

/** Périmètre d'un agent : les établissements dont il a la charge. */
export const userScopes = pgTable(
  'user_scopes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId] })],
);

export const institutionalUsers = pgTable('institutional_users', {
  id: serial('id').primaryKey(),
  /** Compte de l'agent ou du partenaire ; null pour les lignes historiques sans compte. */
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' })
    .unique(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  scope: text('scope').notNull(),
  status: text('status').notNull(),
});

export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(),
  icon: text('icon').notNull(),
  title: text('title').notNull(),
  when: text('when').notNull(),
  tone: text('tone').notNull(),
  status: text('status').notNull(),
  meta: text('meta').notNull(),
  description: text('description').notNull(),
  table: jsonb('table').$type<string[][]>().notNull(),
  action: text('action').notNull(),
  actionIcon: text('action_icon').notNull(),
});

export const visitReports = pgTable('visit_reports', {
  schoolId: text('school_id')
    .notNull()
    .references(() => organizations.id),
  id: serial('id').primaryKey(),
  school: text('school').notNull(),
  date: text('date').notNull(),
  text: text('text').notNull(),
  visibleToSchool: boolean('visible_to_school').notNull().default(false),
  attachmentFileId: text('attachment_file_id'),
});
