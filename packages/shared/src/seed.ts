import type {
  BarRow, Badge, ConfidentialCase, DashboardData, GradeNote, NavItem, Organization, Reward,
  SchoolClass, Student, SubjectGrades, Task, Teacher, TechIncident, ThreadSummary, Message,
  NotificationItem, SessionUser, AttendanceStatus,
} from './types.js';
import type { Role, WebSpace } from './roles.js';

/* ----------------------------------------------------------------------------
   Données de démonstration issues du design « plateforme multiprofile ».
   Elles alimentent l'API en mémoire (apps/api) et servent de repli hors ligne.
---------------------------------------------------------------------------- */

export const SCHOOL_NAME = 'Lycée Léon Mba';
/** Établissements de démonstration (identifiants d'organisation). Chaque donnée scolaire appartient à l'un d'eux. */
export const DEMO_SCHOOL_ID = 'o2';
export const SECOND_SCHOOL_ID = 'o6';
export const SECOND_SCHOOL_NAME = 'Collège Bessieux';
/** École Saint-Michel : celle de Junior, le second enfant du parent de démonstration. */
export const THIRD_SCHOOL_ID = 'o7';
export const JUNIOR = {
  klass: { id: 'sm-cm2', name: 'CM2', level: 'Primaire' as const, capacity: 35, students: 30, completion: 70 },
  student: { id: 'sm-junior', firstName: 'Junior', lastName: 'Ondo', classId: 'sm-cm2', code: '340267' },
};
export const DEMO_PASSWORD = 'motdepasse1';

export const DEMO_USERS: Record<Role, SessionUser> = {
  eleve: { id: 'u-eleve', name: 'Aïcha Ondo', initials: 'AO', phone: '07123456', role: 'eleve', title: 'Élève · 3ème B', organization: SCHOOL_NAME },
  parent: { id: 'u-parent', name: 'Christelle Ondo', initials: 'CO', phone: '06442187', role: 'parent', title: 'Parent · 2 enfants' },
  enseignant: { id: 'u-prof', name: 'Serge Ndong', initials: 'SN', phone: '07801245', role: 'enseignant', title: 'Enseignant · Mathématiques', organization: SCHOOL_NAME },
  etablissement: { id: 'u-ecole', name: 'Pauline Essono', initials: 'PE', phone: '07000001', role: 'etablissement', title: `Direction · ${SCHOOL_NAME}`, organization: SCHOOL_NAME },
  agent: { id: 'u-agent', name: 'Jean-Paul Mouélé', initials: 'JM', phone: '07000002', role: 'agent', title: 'Agent · Estuaire' },
  partenaire: { id: 'u-part', name: 'Ministère — Direction régionale', initials: 'MR', phone: '07000003', role: 'partenaire', title: 'Partenaire · lecture seule' },
  admin: { id: 'u-admin', name: 'Équipe plateforme', initials: 'AD', phone: '07000004', role: 'admin', title: 'Administrateur' },
};

/* ---- Élèves, classes, enseignants (espace établissement) ---- */
const S = (id: string, first: string, last: string, classId: string, phone: string | null, code: string, parents: [string, string][]): Student => ({
  id, firstName: first, lastName: last, classId, phone, code, parents: parents.map(([name, relation]) => ({ name, relation })), activated: phone !== null,
});
export const STUDENTS: Student[] = [
  S('s1', 'Aïcha', 'Ondo', '3b', '07123456', '482917', [['Christelle Ondo', 'mère'], ['Paul Ondo', 'père']]),
  S('s2', 'Brice', 'Nzé', '4a', '07123000', '305662', [['Martine Nzé', 'mère']]),
  S('s3', 'Cyrielle', 'Mba', '3b', '07324570', '771048', [['Jean Mba', 'père'], ['Odile Mba', 'mère']]),
  S('s4', 'Daniel', 'Obiang', '3b', '07883102', '219530', []),
  S('s5', 'Emmanuella', 'Moussavou', '1c', '07324567', '664102', [['Rose Moussavou', 'tutrice']]),
  S('s6', 'Fabrice', 'Mintsa', '6c', '07110954', '538471', []),
  S('s7', 'Grâce', 'Nguema', '4a', '06214490', '190826', [['Alain Nguema', 'père']]),
  S('s8', 'Hervé', 'Mabika', '5b', null, '847335', []),
  // Autres élèves de la 3ème B (la classe de démonstration compte ainsi huit élèves en base).
  S('s9', 'Lionel', 'Bekale', '3b', '07334455', '410128', []),
  S('s10', 'Mariam', 'Ondimba', '3b', '06223344', '520239', []),
  S('s11', 'Nathan', 'Ekomi', '3b', '07112299', '630340', []),
  S('s12', 'Océane', 'Ndzengue', '3b', '06998811', '740451', []),
  S('s13', 'Patrick', 'Obame', '3b', '07445500', '850562', []),
];

export const CLASSES: SchoolClass[] = [
  { id: 'ta', name: 'Terminale A', level: 'Lycée', capacity: 40, students: 36, completion: 82 },
  { id: '1c', name: 'Première C', level: 'Lycée', capacity: 40, students: 38, completion: 79 },
  { id: '3b', name: '3ème B', level: 'Collège', capacity: 40, students: 38, completion: 74 },
  { id: '4a', name: '4ème A', level: 'Collège', capacity: 45, students: 42, completion: 61 },
  { id: '5b', name: '5ème B', level: 'Collège', capacity: 45, students: 44, completion: 38, alert: 'Engagement faible' },
  { id: '6c', name: '6ème C', level: 'Collège', capacity: 45, students: 45, completion: 41, alert: 'Engagement faible' },
];

export const TEACHERS: Teacher[] = [
  { id: 't1', name: 'Serge Ndong', phone: '+241 07 80 12 45', assignments: 'Maths · 3ème B, 4ème A, 6ème C', status: 'Activé' },
  { id: 't2', name: 'Marie Ayo', phone: '+241 06 15 77 30', assignments: 'Français · 4ème A', status: 'Activé' },
  { id: 't3', name: 'Rachel Nziengui', phone: '+241 07 41 02 66', assignments: 'Anglais · 3ème B', status: 'Invitation envoyée' },
  { id: 't4', name: 'Luc Ella', phone: '+241 07 90 33 18', assignments: 'Physique · Seconde A', status: 'Activé' },
  { id: 't5', name: 'Joël Ekomi', phone: '+241 06 52 87 11', assignments: '', status: 'Invitation expirée' },
];

export interface LinkRequest { id: string; parent: string; relation: string; child: string; meta: string }
export const LINK_REQUESTS: LinkRequest[] = [
  { id: 'r1', parent: 'Pierre Nzé', relation: 'père', child: 'Brice Nzé', meta: 'Numéro différent de celui enregistré par l’école · demandé il y a 3 h' },
  { id: 'r2', parent: 'Albert Obiang', relation: 'père', child: 'Daniel Obiang', meta: 'QR code scanné · numéro inconnu de l’école · hier' },
  { id: 'r3', parent: 'Félicité Mintsa', relation: 'tutrice', child: 'Fabrice Mintsa', meta: 'Code expiré · 8 nov.' },
];

export const SCHOOL_YEAR = {
  label: '2026–2027',
  start: '2026-09-07',
  end: '2027-06-30',
  active: true,
  terms: [
    { name: '1er trimestre', start: '2026-09-07', end: '2026-12-18', coefficient: 1 },
    { name: '2ème trimestre', start: '2027-01-05', end: '2027-03-26', coefficient: 1 },
    { name: '3ème trimestre', start: '2027-04-12', end: '2027-06-30', coefficient: 1 },
  ],
};

/** Affectations des enseignants (enseignant, classe, matière). Serge Ndong (t1) est le compte enseignant de démonstration. */
export const ASSIGNMENTS = [
  { id: 'a1', teacherId: 't1', classId: '3b', subject: 'Mathématiques', year: '2026–2027', principal: true },
  { id: 'a2', teacherId: 't1', classId: '4a', subject: 'Mathématiques', year: '2026–2027', principal: false },
  { id: 'a5', teacherId: 't1', classId: '6c', subject: 'Mathématiques', year: '2026–2027', principal: false },
  { id: 'a3', teacherId: 't2', classId: '4a', subject: 'Français', year: '2026–2027', principal: true },
  { id: 'a4', teacherId: 't3', classId: '3b', subject: 'Anglais', year: '2026–2027', principal: false },
];

/* ---- Vie scolaire : absences et signalements ---- */
/** Appels de démonstration (ISO) : élèves absents ou en retard les 9 et 10 novembre. */
export const ATTENDANCE_SEED: { classId: string; studentId: string; date: string; status: AttendanceStatus; justification: string | null }[] = [
  { classId: 'sm-cm2', studentId: 'sm-junior', date: '2026-11-10', status: 'A', justification: null },
  { classId: '3b', studentId: 's4', date: '2026-11-10', status: 'R', justification: 'Transport' },
  { classId: '4a', studentId: 's2', date: '2026-11-09', status: 'A', justification: 'Maladie' },
  { classId: '5b', studentId: 's8', date: '2026-11-09', status: 'A', justification: null },
];

export const CONFIDENTIAL_CASES: ConfidentialCase[] = [
  { id: 'SC-0142', reporter: 'Enseignant · S. Ndong', className: '3ème B', type: 'Harcèlement', received: 'aujourd’hui, 09:12', student: 'Brice Nzé', text: 'Brice semble isolé à la récréation ; plusieurs élèves se moquent de lui depuis une semaine et il ne veut plus venir en cours de sport.' },
  { id: 'SC-0139', reporter: 'Parent', className: '5ème B', type: 'Mal-être', received: 'hier, 14:20', student: 'Hervé Mabika', text: 'Mon fils dort mal et refuse de parler de l’école depuis la rentrée des vacances.' },
  { id: 'SC-0131', reporter: 'Enseignant · L. Ella', className: 'Seconde A', type: 'Difficulté personnelle', received: '28 oct., 11:05', student: 'Élève de Seconde A', text: 'L’élève a confié des difficultés familiales importantes qui l’empêchent de travailler le soir.' },
];

/* ---- Élève : tâches, résultats, trophées ---- */
export const TASKS: Task[] = [
  { id: 'k1', title: 'Fractions : exercices 4 à 9, p. 52', subject: 'Mathématiques', type: 'Exercice', due: 'Aujourd’hui, 18 h', status: 'todo', estimate: '30 min' },
  { id: 'k2', title: 'Lecture du chapitre 3 et résumé', subject: 'Français', type: 'Cours', due: 'Aujourd’hui, 20 h', status: 'doing', estimate: '20 min' },
  { id: 'k3', title: 'Les neuf provinces du Gabon', subject: 'Histoire-Géo', type: 'Cours', due: 'Aujourd’hui', status: 'done', estimate: '15 min' },
  { id: 'k4', title: 'Photosynthèse : fiche de synthèse', subject: 'SVT', type: 'Devoir', due: 'Jeudi 12 nov.', status: 'todo', estimate: '45 min' },
  { id: 'k5', title: 'Present perfect : exercices 1 à 3', subject: 'Anglais', type: 'Exercice', due: 'Vendredi 13 nov.', status: 'todo', estimate: '25 min' },
  { id: 'k6', title: 'Le théorème de Thalès', subject: 'Mathématiques', type: 'Cours', due: 'Lundi 9 nov.', status: 'done', estimate: '20 min' },
];

const N = (label: string, value: number, meta: string, comment: string): GradeNote => ({ label, value, meta, comment });
export const SUBJECT_GRADES: SubjectGrades[] = [
  { subject: 'Mathématiques', average: 15.2, coefficient: 4, notes: [N('Interrogation n°1', 14, '10 oct. · coef. 1', 'Bon raisonnement, attention aux signes.'), N('Devoir surveillé', 15.5, '24 oct. · coef. 2', 'Très bon travail, continue.')] },
  { subject: 'Français', average: 12.5, coefficient: 4, notes: [N('Dissertation', 12.5, '18 oct. · coef. 2', 'Plan clair, développe davantage tes exemples.')] },
  { subject: 'Anglais', average: 12, coefficient: 2, notes: [N('Interrogation n°1', 12, '21 oct. · coef. 1', 'Revois les verbes irréguliers.')] },
  { subject: 'SVT', average: 14.5, coefficient: 2, notes: [N('TP photosynthèse', 14.5, '15 oct. · coef. 1', 'Schéma soigné.')] },
  { subject: 'Histoire-Géo', average: 13, coefficient: 3, notes: [N('Carte du Gabon', 13, '8 oct. · coef. 1', 'Légende incomplète.')] },
  { subject: 'Physique-Chimie', average: 11.5, coefficient: 3, notes: [N('Interrogation n°1', 11.5, '22 oct. · coef. 1', 'Bien pour les unités, revois les conversions.')] },
];
export const OVERALL_AVERAGE = 13.8;

export const BADGES: Badge[] = [
  { icon: 'footprints', label: 'Premier pas', earned: true },
  { icon: 'flame', label: 'Série de 5 jours', earned: true },
  { icon: 'book-open', label: 'Lecteur assidu', earned: true },
  { icon: 'target', label: '10 tâches terminées', earned: true },
  { icon: 'star', label: 'Série de 10 jours', earned: false },
  { icon: 'trophy', label: '2 000 points', earned: false },
];
export const POINTS_HISTORY = [
  { label: 'Les neuf provinces du Gabon', when: 'Aujourd’hui', points: '+15' },
  { label: 'Lecture du chapitre 2', when: 'Hier', points: '+20' },
  { label: 'Série de 5 jours', when: 'Hier', points: '+50' },
  { label: 'Le théorème de Thalès', when: 'Lundi', points: '+15' },
];
export const STUDENT_START = { points: 1240, streak: 5, doneToday: 2, dailyGoal: 4 };

/* ---- Parent ---- */
export const WEEK_MINUTES = [
  { day: 'L', minutes: 55 }, { day: 'M', minutes: 70 }, { day: 'M', minutes: 40 },
  { day: 'J', minutes: 65 }, { day: 'V', minutes: 30 }, { day: 'S', minutes: 80 }, { day: 'D', minutes: 0 },
];
export const REWARDS: Reward[] = [
  { id: 'rw1', label: 'Sortie au parc', threshold: 1500 },
  { id: 'rw2', label: 'Un nouveau livre', threshold: 1000 },
  { id: 'rw3', label: 'Soirée cinéma en famille', threshold: 2500 },
];
export const ALERT_PREFS = [
  { id: 'a1', label: 'Une tâche non faite 24 h avant l’échéance', on: true },
  { id: 'a2', label: 'Aucune activité pendant 3 jours', on: true },
  { id: 'a3', label: 'Une absence ou un retard', on: true },
  { id: 'a4', label: 'Une nouvelle note publiée', on: false },
];
export const PARENT_ALERTS = [
  { icon: 'user-x', text: 'Junior a été signalé absent ce matin (8 h – 10 h).', when: 'Aujourd’hui, 10:05', hot: true },
  { icon: 'award', text: 'Nouvelle note pour Aïcha : Mathématiques, 15,5/20.', when: 'Hier', hot: false },
  { icon: 'clock', text: '« Fractions » d’Aïcha est à rendre demain à 18 h.', when: 'Hier', hot: false },
  { icon: 'moon', text: 'Aucune activité de Junior depuis 3 jours.', when: 'Dimanche', hot: false },
];

/* ---- Enseignant ---- */
/** Suivi d'une tâche : [statut, temps, auto-évaluation, preuve]. */
export const FOLLOW_UP: [string, string, 'ok' | 'doubt' | '', boolean][] = [
  ['done', '24 min', 'ok', true], ['done', '3 min', 'ok', false], ['done', '31 min', 'doubt', true], ['none', '—', '', false],
  ['doing', '12 min', '', false], ['done', '27 min', 'doubt', false], ['none', '—', '', false], ['done', '19 min', 'ok', true],
];
export const ANNOUNCE_TEMPLATES: Record<string, string> = {
  Évaluation: 'Bonjour, demain nous aurons une évaluation de mathématiques sur le chapitre 3. Pensez à réviser.',
  Réunion: 'Bonjour, une réunion parents-professeurs aura lieu le 20 novembre à 16 h.',
  Sortie: 'Bonjour, une sortie au Musée national est prévue le 27 novembre. Merci de signer l’autorisation.',
  Fermeture: 'Bonjour, l’établissement sera fermé lundi. Les cours reprendront mardi.',
};

/* ---- Messagerie et notifications (mobile) ---- */
export const THREADS: Record<'eleve' | 'parent' | 'enseignant', ThreadSummary[]> = {
  parent: [
    { id: 'th1', initials: 'ND', name: 'M. Ndong', kind: 'Classe · professeur principal d’Aïcha', last: 'Bien sûr, nous le reprendrons demain.', time: '09:52', unread: 1 },
    { id: 'th2', initials: '', name: 'Administration', kind: 'École · Lycée Léon Mba', last: 'Réunion parents-professeurs le 20 novembre.', time: 'Hier', unread: 0, icon: 'school' },
    { id: 'th3', initials: 'MN', name: 'Mme Nziengui', kind: 'Classe · maîtresse de Junior', last: 'Junior peut revenir demain avec un mot.', time: 'Lun.', unread: 1 },
  ],
  eleve: [
    { id: 'th9', initials: 'ND', name: 'M. Ndong', kind: 'Privé · Mathématiques', last: 'Bien sûr, nous le reprendrons demain.', time: '09:52', unread: 1 },
    { id: 'th4', initials: '', name: 'Classe 3ème B', kind: 'Classe · 38 membres', last: 'Évaluation demain sur le chapitre 3.', time: '08:10', unread: 2, icon: 'users' },
    { id: 'th5', initials: '', name: 'Vie scolaire', kind: 'École · Lycée Léon Mba', last: 'Sortie au Musée national le 27 novembre.', time: 'Lun.', unread: 0, icon: 'school' },
  ],
  enseignant: [
    { id: 'th6', initials: 'MO', name: 'Mme Ondo', kind: 'Privé · parent d’Aïcha Ondo', last: 'Elle avait des doutes sur l’exercice 7…', time: '09:40', unread: 1 },
    { id: 'th7', initials: '', name: 'Parents de 3ème B', kind: 'Classe · 61 parents', last: 'Annonce : évaluation demain, chapitre 3.', time: '08:05', unread: 0, icon: 'users' },
    { id: 'th8', initials: '', name: 'Direction', kind: 'École · Lycée Léon Mba', last: 'Merci de saisir les notes du 1er trimestre avant vendredi.', time: 'Hier', unread: 1, icon: 'school' },
  ],
};
export const CONVERSATION: Message[] = [
  { id: 'm1', mine: false, text: 'Bonjour, Aïcha a très bien travaillé sur les fractions cette semaine.', time: '09:12' },
  { id: 'm2', mine: true, text: 'Merci ! Elle avait des doutes sur l’exercice 7. Pouvez-vous l’aider demain ?', time: '09:40' },
  { id: 'm3', mine: true, text: null, image: true, time: '09:41' },
  { id: 'm4', mine: false, text: 'Bien sûr, nous le reprendrons demain en début de cours.', time: '09:52' },
];
export const NOTIFICATIONS: Record<'eleve' | 'parent' | 'enseignant', Omit<NotificationItem, 'read'>[]> = {
  eleve: [
    { id: 'n1', icon: 'award', text: 'Nouvelle note en Mathématiques : 15,5/20.', when: 'Il y a 20 min', target: '/resultats' },
    { id: 'n2', icon: 'clipboard-list', text: 'Nouvelle tâche : Photosynthèse, fiche de synthèse (SVT).', when: 'Il y a 2 h', target: '/taches' },
    { id: 'n3', icon: 'megaphone', text: 'M. Ndong : évaluation demain sur le chapitre 3.', when: 'Il y a 2 h', target: '/messages' },
    { id: 'n4', icon: 'flame', text: 'Série de 5 jours, bravo !', when: 'Hier', target: '/trophees' },
    { id: 'n5', icon: 'clock', text: '« Fractions » est à rendre aujourd’hui à 18 h.', when: 'Hier', target: '/taches/k1' },
  ],
  parent: [
    { id: 'n1', icon: 'user-x', text: 'Junior a été signalé absent ce matin.', when: '10:05', target: '/alertes' },
    { id: 'n2', icon: 'award', text: 'Nouvelle note pour Aïcha : 15,5/20.', when: 'Hier', target: '/activite' },
    { id: 'n3', icon: 'message-circle', text: 'M. Ndong vous a répondu.', when: 'Hier', target: '/messages' },
  ],
  enseignant: [
    { id: 'n1', icon: 'message-circle', text: 'Mme Ondo vous a écrit.', when: '09:40', target: '/messages' },
    { id: 'n2', icon: 'circle-help', text: '5 élèves ont des doutes sur « Fractions ».', when: '09:12', target: '/suivi' },
    { id: 'n3', icon: 'shield', text: 'Direction : notes du 1er trimestre à saisir avant vendredi.', when: 'Hier', target: '/notes' },
  ],
};
export const FAQ = [
  { icon: 'key-round', q: 'Je ne reçois pas le code SMS', a: ['Vérifiez que le numéro est saisi au format +241….', 'Attendez 60 secondes puis demandez un nouveau code.', 'Vérifiez que vous avez du réseau mobile.', 'Contactez le support si le problème persiste.'] },
  { icon: 'wifi-off', q: 'L’application fonctionne-t-elle hors ligne ?', a: ['Oui : tâches, complétions et notes peuvent être créées sans connexion.', 'Tout est synchronisé dès que le réseau revient.', 'Une icône indique les actions en attente.'] },
  { icon: 'file-question', q: 'Je ne vois pas les notes de mon enfant', a: ['Vérifiez que vous êtes bien rattaché à l’enfant.', 'Les notes ne sont visibles qu’après publication.', 'Sinon, contactez l’administration de l’école.'] },
  { icon: 'bell-off', q: 'Je ne reçois pas les notifications', a: ['Mon compte › Notifications : vérifiez que les alertes sont activées.', 'Vérifiez les réglages de notifications du téléphone.', 'Sans smartphone, demandez à l’école d’activer le relais SMS.'] },
];
export const TIPS = [
  'Utilisez un mot de passe fort et ne le partagez pas.',
  'N’envoyez pas de photos contenant des données sensibles d’autrui.',
  'Signalez tout contenu inapproprié ou problématique.',
  'Gardez l’application à jour.',
];
export const SUPPORT = { email: 'support@gestioneleves.ga', priorityLine: '+241 01 00 00 00' };

/* ---- Espaces web : navigation par profil ---- */
export const WEB_NAV: Record<WebSpace, NavItem[]> = {
  ecole: [
    { icon: 'layout-dashboard', label: 'Tableau de bord', to: '/ecole' },
    { icon: 'users', label: 'Utilisateurs', badge: '3', to: '/ecole/utilisateurs' },
    { icon: 'school', label: 'Classes', to: '/ecole/configuration?tab=classes' },
    { icon: 'calendar-check', label: 'Absences', badge: '12', to: '/ecole/absences' },
    { icon: 'award', label: 'Résultats', to: '/ecole/resultats' },
    { icon: 'megaphone', label: 'Annonces', to: '/ecole/annonces' },
    { icon: 'shield', label: 'Vie scolaire', badge: '1', to: '/ecole/vie-scolaire' },
    { icon: 'settings', label: 'Configuration', to: '/ecole/configuration' },
    { icon: 'network', label: 'Vue réseau', to: '/ecole/reseau' },
    { icon: 'credit-card', label: 'Mon abonnement', to: '/ecole/abonnement' },
  ],
  agent: [
    { icon: 'building-2', label: 'Mes écoles', badge: '8', to: '/agent' },
    { icon: 'file-text', label: 'Comptes-rendus', to: '/agent/comptes-rendus' },
    { icon: 'school', label: 'Fiche école', to: '/agent/ecole' },
    { icon: 'bell', label: 'Alertes', badge: '4', to: '/agent/alertes' },
  ],
  partenaire: [
    { icon: 'chart-no-axes-column', label: 'Indicateurs', to: '/partenaire' },
    { icon: 'map-pin', label: 'Par région', to: '/partenaire/regions' },
    { icon: 'shield', label: 'Signalements', to: '/partenaire/signalements' },
    { icon: 'download', label: 'Exports', to: '/partenaire/exports' },
  ],
  admin: [
    { icon: 'layout-dashboard', label: 'Vue globale', to: '/admin' },
    { icon: 'building-2', label: 'Organisations', to: '/admin/organisations' },
    { icon: 'credit-card', label: 'Abonnements', badge: '5', to: '/admin/abonnements' },
    { icon: 'user-cog', label: 'Agents & partenaires', to: '/admin/utilisateurs' },
    { icon: 'activity', label: 'Incidents', badge: '2', to: '/admin/incidents' },
  ],
};

/* ---- Tableaux de bord par espace ---- */
const bar = (label: string, pct: number, display?: string): BarRow => ({ label, pct, display });

export const DASHBOARDS: Record<WebSpace, DashboardData> = {
  ecole: {
    head: { kicker: 'Lycée Léon Mba · Libreville · année 2026–2027', title: 'Tableau de bord', action: 'Importer des élèves', actionIcon: 'upload', toast: '', filters: [{ icon: 'calendar', label: '1er trimestre' }] },
    kpis: [
      { label: 'Élèves actifs', value: '812', unit: ' / 940', sub: '86 % des comptes activés', icon: 'backpack' },
      { label: 'Parents actifs', value: '63', unit: '%', sub: '+8 pts depuis septembre', icon: 'users' },
      { label: 'Enseignants', value: '41', unit: ' / 44', sub: '3 invitations en attente', icon: 'graduation-cap' },
      { label: 'Complétion des tâches', value: '74', unit: '%', sub: 'sur les 7 derniers jours', icon: 'list-checks' },
    ],
    chart: { title: 'Complétion des tâches par classe', sub: '7 derniers jours', legendA: 'Normal', legendB: 'Engagement faible (< 45 %)', rows: [bar('Terminale A', 82), bar('Première C', 79), bar('3ème B', 74), bar('4ème A', 61), bar('5ème B', 38), bar('6ème C', 41)] },
    side: { title: 'À traiter', items: [
      { icon: 'circle-alert', title: '5ème B — engagement faible', text: '38 % de complétion, 11 élèves inactifs depuis 3 jours.', cta: 'Voir la classe', highlight: true },
      { icon: 'clock', title: 'Notes de Physique en retard', text: '3ème A · 1er trimestre · J+6 après l’échéance.', cta: 'Relancer' },
      { icon: 'shield', title: '1 signalement confidentiel', text: 'Accusé de réception attendu sous 4 h.', cta: 'Ouvrir' },
    ] },
    table: { title: 'Activation des comptes', note: 'mise à jour il y a 5 min', columns: '1.4fr 1fr 1fr 1fr 1fr', head: ['Classe', 'Élèves', 'Parents', 'Notes saisies', 'Appel'], rows: [
      ['Terminale A', '36 / 36', '29 / 36', '100 %', 'À jour'], ['3ème B', '38 / 38', '31 / 38', '92 %', 'À jour'], ['4ème A', '40 / 42', '22 / 42', '85 %', 'À jour'],
      ['5ème B', '33 / 44', '14 / 44', '60 %', 'En retard · 2 j'], ['6ème C', '41 / 45', '18 / 45', '71 %', 'À jour'],
    ] },
  },
  agent: {
    head: { kicker: 'Province de l’Estuaire · 8 établissements', title: 'Mes écoles', action: 'Nouveau compte-rendu', actionIcon: 'file-pen-line', toast: '', filters: [{ icon: 'calendar', label: 'Cette semaine' }] },
    kpis: [
      { label: 'Utilisateurs actifs', value: '4 812', unit: '', sub: 'élèves, parents et enseignants', icon: 'users' },
      { label: 'Complétion moyenne', value: '68', unit: '%', sub: '−3 pts sur la semaine', icon: 'list-checks' },
      { label: 'Absences signalées', value: '127', unit: '', sub: 'cette semaine', icon: 'user-x' },
      { label: 'Écoles en alerte', value: '2', unit: ' / 8', sub: 'saisie ou activation faibles', icon: 'circle-alert' },
    ],
    chart: { title: 'Complétion des tâches cette semaine', sub: 'par établissement', legendA: 'Normal', legendB: 'À surveiller', rows: [bar('Lycée Léon Mba', 74), bar('Collège Bessieux', 71), bar('École Saint-Michel', 69), bar('Lycée d’Owendo', 66), bar('Collège de Nzeng-Ayong', 42), bar('École Akébé-Plaine', 37)] },
    side: { title: 'Derniers comptes-rendus', items: [
      { icon: 'file-text', title: 'Collège Bessieux · 6 nov.', text: 'Formation des enseignants à la saisie des notes : 14 présents.', cta: 'Lire' },
      { icon: 'file-text', title: 'École Akébé-Plaine · 3 nov.', text: 'Réseau instable ; prévoir relais SMS pour les parents.', cta: 'Lire', highlight: true },
      { icon: 'file-text', title: 'Lycée d’Owendo · 28 oct.', text: 'Bonne dynamique, référent vie scolaire désigné.', cta: 'Lire' },
    ] },
    table: { title: 'Engagement par école', note: 'semaine du 9 au 15 nov.', columns: '1.8fr 1fr 1fr 1fr 1.2fr', head: ['Établissement', 'Actifs', 'Complétion', 'Absences', 'Statut'], rows: [
      ['Lycée Léon Mba', '1 204', '74 %', '31', 'Actif'], ['Collège Bessieux', '846', '71 %', '18', 'Actif'], ['École Saint-Michel', '512', '69 %', '9', 'Actif'],
      ['Collège de Nzeng-Ayong', '688', '42 %', '27', 'Faible activation'], ['École Akébé-Plaine', '301', '37 %', '22', 'En retard de saisie'],
    ] },
  },
  partenaire: {
    head: { kicker: 'Données agrégées et anonymisées', title: 'Indicateurs nationaux', action: 'Exporter', actionIcon: 'download', toast: 'Export CSV prêt · les cellules de moins de 10 personnes restent masquées.', filters: [{ icon: 'map-pin', label: 'Toutes les régions' }, { icon: 'school', label: 'Tous niveaux' }] },
    kpis: [
      { label: 'Taux d’activation', value: '71', unit: '%', sub: 'comptes élèves activés', icon: 'user-check' },
      { label: 'Complétion des tâches', value: '66', unit: '%', sub: 'moyenne sur 30 jours', icon: 'list-checks' },
      { label: 'Taux de présence', value: '93', unit: '%', sub: 'appels saisis sur 30 jours', icon: 'calendar-check' },
      { label: 'Établissements', value: '128', unit: '', sub: 'dans 9 provinces', icon: 'building-2' },
    ],
    chart: { title: 'Taux de présence par province', sub: '30 derniers jours', legendA: 'Normal', legendB: 'Sous la moyenne', rows: [bar('Estuaire', 94), bar('Haut-Ogooué', 92), bar('Ogooué-Maritime', 91), bar('Woleu-Ntem', 89), bar('Ngounié', 88), bar('Nyanga', 0, 'masqué')] },
    side: { title: 'Confidentialité', items: [
      { icon: 'eye-off', title: 'Seuil de 10 personnes', text: 'Toute cellule plus petite est masquée automatiquement.', cta: 'En savoir plus' },
      { icon: 'lock', title: 'Aucune donnée nominative', text: 'Les signalements sont comptés par type et statut uniquement.', cta: 'Charte' },
    ] },
    table: { title: 'Signalements par type et statut', note: 'année en cours', columns: '1.6fr 1fr 1fr 1fr', head: ['Type', 'Ouverts', 'En cours', 'Clos'], rows: [
      ['Conduite / engagement', '46', '31', '212'], ['Confidentiel — harcèlement', 'masqué', '12', '38'],
      ['Confidentiel — mal-être', 'masqué', 'masqué', '17'], ['Confidentiel — difficulté personnelle', '11', 'masqué', '24'],
    ] },
  },
  admin: {
    head: { kicker: 'Plateforme · novembre 2026', title: 'Vue globale', action: 'Nouvelle organisation', actionIcon: 'plus', toast: '', filters: [{ icon: 'calendar', label: '30 derniers jours' }] },
    kpis: [
      { label: 'Écoles actives', value: '128', unit: '', sub: 'dont 14 en essai', icon: 'school' },
      { label: 'Utilisateurs actifs', value: '46 210', unit: '', sub: '+2 140 ce mois', icon: 'users' },
      { label: 'Complétion globale', value: '71', unit: '%', sub: 'toutes écoles', icon: 'list-checks' },
      { label: 'Revenus récurrents', value: '18,4', unit: 'M', sub: 'FCFA / mois (MRR estimé)', icon: 'banknote' },
    ],
    chart: { title: 'Écoles par formule', sub: 'abonnements actifs', legendA: 'Actif', legendB: 'Faible part', rows: [bar('Essentiel', 52, '67'), bar('Standard', 36, '46'), bar('Réseau', 8, '10'), bar('Diocésain', 4, '5')] },
    side: { title: 'Alertes techniques', items: [
      { icon: 'refresh-cw-off', title: 'Synchronisation hors ligne en échec', text: '14 appareils · École Akébé-Plaine, Collège de Nzeng-Ayong.', cta: 'Voir', highlight: true },
      { icon: 'message-square-warning', title: 'Retards d’envoi SMS', text: 'Opérateur : délai moyen 4 min ce matin.', cta: 'Suivre' },
    ] },
    table: { title: 'Organisations', note: '143 au total', columns: '1.8fr 1fr 1fr 1fr 1fr', head: ['Organisation', 'Type', 'Formule', 'Statut', 'Échéance'], rows: [
      ['Diocèse de Libreville', 'Diocèse', 'Diocésain', 'Actif', '31/08/2027'], ['Lycée Léon Mba', 'École', 'Standard', 'Actif', '31/12/2026'],
      ['Réseau des écoles du Haut-Ogooué', 'Réseau', 'Réseau', 'Actif', '30/06/2027'], ['Collège de Nzeng-Ayong', 'École', 'Essentiel', 'Essai · 12 j', ''],
      ['École Akébé-Plaine', 'École', 'Essentiel', 'Suspendu', '—'],
    ] },
  },
};

export const NETWORK_DASHBOARD: Pick<DashboardData, 'kpis' | 'chart' | 'side' | 'table'> = {
  kpis: [
    { label: 'Établissements', value: '3', unit: '', sub: 'Diocèse de Libreville', icon: 'school' },
    { label: 'Utilisateurs actifs', value: '2 362', unit: '', sub: 'élèves, parents et enseignants', icon: 'users' },
    { label: 'Complétion moyenne', value: '71', unit: '%', sub: '7 derniers jours', icon: 'list-checks' },
    { label: 'Absences', value: '58', unit: '', sub: 'cette semaine, 3 écoles', icon: 'user-x' },
  ],
  chart: { title: 'Complétion des tâches par école', sub: '7 derniers jours', legendA: 'Normal', legendB: 'Engagement faible (< 45 %)', rows: [bar('Lycée Léon Mba', 74), bar('Collège Bessieux', 71), bar('École Saint-Michel', 69)] },
  side: { title: 'Alertes du réseau', items: [
    { icon: 'circle-alert', title: 'Lycée Léon Mba · 5ème B', text: '38 % de complétion cette semaine.', cta: 'Ouvrir', highlight: true },
    { icon: 'clock', title: 'Collège Bessieux · notes', text: 'Physique 3ème A : saisie en retard de 4 jours.', cta: 'Relancer' },
    { icon: 'users', title: 'École Saint-Michel · parents', text: '52 % des parents rattachés.', cta: 'Voir' },
  ] },
  table: { title: 'Comparatif des établissements', note: 'mise à jour il y a 5 min', columns: '1.8fr 1fr 1fr 1fr 1fr', head: ['Établissement', 'Élèves actifs', 'Parents', 'Complétion', 'Formule'], rows: [
    ['Lycée Léon Mba', '812 / 940', '63 %', '74 %', 'Actif'], ['Collège Bessieux', '588 / 640', '58 %', '71 %', 'Actif'], ['École Saint-Michel', '402 / 470', '52 %', '69 %', 'Actif'],
  ] },
};

/* ---- Partenaire : indicateurs par province (nom, nb d'écoles, activation, complétion, présence, signalements) ---- */
export const PROVINCES: [string, number, string, string, string, string][] = [
  ['Estuaire', 52, '78 %', '71 %', '94 %', '186'], ['Haut-Ogooué', 18, '74 %', '68 %', '92 %', '41'],
  ['Ogooué-Maritime', 14, '72 %', '66 %', '91 %', '29'], ['Woleu-Ntem', 11, '69 %', '63 %', '89 %', '22'],
  ['Ngounié', 9, '66 %', '61 %', '88 %', '14'], ['Moyen-Ogooué', 7, '64 %', '60 %', '90 %', '11'],
  ['Nyanga', 6, '61 %', '58 %', 'masqué', 'masqué'], ['Ogooué-Ivindo', 6, '59 %', '55 %', '87 %', 'masqué'],
  ['Ogooué-Lolo', 5, 'masqué', 'masqué', 'masqué', 'masqué'],
];
export const LEVEL_FACTOR = { Tous: 1, Primaire: 0.92, Collège: 1.02, Lycée: 1.05 } as const;

/* ---- Agent ---- */
export const AGENT_SCHOOL = {
  kpis: [
    { label: 'Utilisateurs actifs', value: '1 204', sub: 'élèves, parents, enseignants' },
    { label: 'Complétion', value: '74 %', sub: '7 derniers jours' },
    { label: 'Absences', value: '31', sub: 'cette semaine' },
    { label: 'Dernière visite', value: '6 nov.', sub: 'il y a 4 jours' },
  ],
  activation: [['Élèves', '812 / 940', 86], ['Parents', '591 / 940', 63], ['Enseignants', '41 / 44', 93]] as [string, string, number][],
  alerts: [
    { icon: 'circle-alert', text: '5ème B : engagement faible (38 %).' },
    { icon: 'clock', text: 'Notes de Physique, 3ème A : 6 jours de retard.' },
    { icon: 'users', text: '37 parents sans rattachement en 6ème C.' },
  ],
  entry: 88,
};
export const VISIT_REPORTS = [
  { id: 'v1', school: 'Collège Bessieux', date: '6 nov.', text: 'Formation des enseignants à la saisie des notes : 14 présents.' },
  { id: 'v2', school: 'École Akébé-Plaine', date: '3 nov.', text: 'Réseau instable ; prévoir relais SMS pour les parents.' },
  { id: 'v3', school: 'Lycée d’Owendo', date: '28 oct.', text: 'Bonne dynamique, référent vie scolaire désigné.' },
];

/* ---- Administration plateforme ---- */
export const ORGANIZATIONS: Organization[] = [
  { id: 'o1', name: 'Diocèse de Libreville', type: 'Diocèse', plan: 'Diocésain', status: 'Actif', due: '31/08/2027' },
  { id: 'o2', name: 'Lycée Léon Mba', type: 'École', plan: 'Standard', status: 'Actif', due: '31/12/2026', parentId: 'o1', province: 'Estuaire', level: 'Lycée' },
  { id: 'o3', name: 'Réseau des écoles du Haut-Ogooué', type: 'Réseau', plan: 'Réseau', status: 'Actif', due: '30/06/2027' },
  { id: 'o4', name: 'Collège de Nzeng-Ayong', type: 'École', plan: 'Essentiel', status: 'Essai · 12 j', due: '', province: 'Estuaire', level: 'Collège' },
  { id: 'o5', name: 'École Akébé-Plaine', type: 'École', plan: 'Essentiel', status: 'Suspendu', due: '—', province: 'Estuaire', level: 'Primaire' },
  { id: 'o6', name: 'Collège Bessieux', type: 'École', plan: 'Essentiel', status: 'Actif', due: '30/06/2027', parentId: 'o1', province: 'Estuaire', level: 'Collège' },
  { id: 'o7', name: 'École Saint-Michel', type: 'École', plan: 'Standard', status: 'Actif', due: '31/12/2026', parentId: 'o1', province: 'Estuaire', level: 'Primaire' },
  { id: 'o8', name: 'Lycée d’Owendo', type: 'École', plan: 'Standard', status: 'Actif', due: '31/12/2026', province: 'Estuaire', level: 'Lycée' },
];
/** Prix mensuel indicatif par formule (FCFA) — l'annuel = 10 mois. */
export const PLAN_PRICES = { Essentiel: 25000, Standard: 60000, Réseau: 140000, Diocésain: 300000 } as const;
export const PLAN_ORDER = ['Essentiel', 'Standard', 'Réseau', 'Diocésain'] as const;
/** Fonctionnalités : [libellé, formule minimale (index dans PLAN_ORDER)]. */
export const PLAN_FEATURES: [string, number][] = [
  ['Suivi des tâches, appel et notes', 0],
  ['Messagerie école–parents', 0],
  ['Invitations et relais par SMS', 1],
  ['Tableaux de bord avancés et exports', 1],
  ['Vue réseau multi-établissements', 2],
  ['Hiérarchie diocésaine et agents dédiés', 3],
];

export const AGENT_USERS = [
  { name: 'Jean-Paul Mouélé', role: 'Agent', scope: '8 écoles · Estuaire', status: 'Actif' },
  { name: 'Sylvie Bekale', role: 'Agent', scope: '6 écoles · Haut-Ogooué', status: 'Actif' },
  { name: 'Ministère — Direction régionale', role: 'Partenaire', scope: 'Toutes les provinces', status: 'Actif' },
  { name: 'UNICEF Gabon (programme éducation)', role: 'Partenaire', scope: 'Estuaire, Ngounié', status: 'Invitation envoyée' },
];
export const AGENT_SCOPES = ['Lycée Léon Mba', 'Collège Bessieux', 'École Saint-Michel', 'École Akébé-Plaine'];
export const PARTNER_SCOPES = ['Estuaire', 'Haut-Ogooué', 'Ngounié', 'Woleu-Ntem'];

export const TECH_INCIDENTS: TechIncident[] = [
  { id: 'i1', icon: 'refresh-cw-off', title: 'Synchronisation hors ligne en échec', when: 'Il y a 2 h', tone: 'warn', status: 'En cours', meta: '14 appareils dans 2 écoles · première occurrence ce matin à 07:42', description: 'Des appareils accumulent des données hors ligne (appels, complétions) qui ne remontent pas : la file locale dépasse 72 h pour certains. Les données restent sur les téléphones tant qu’elles ne sont pas synchronisées.', table: [['Appareil', 'École', 'En attente', 'Dernier essai'], ['Android · S. Ndong', 'Collège de Nzeng-Ayong', '38 éléments', '07:42'], ['Android · J. Ekomi', 'École Akébé-Plaine', '112 éléments', '06:58'], ['Android · 12 élèves', 'École Akébé-Plaine', '4 à 20', 'hier']], action: 'Forcer une nouvelle synchronisation', actionIcon: 'refresh-cw' },
  { id: 'i2', icon: 'message-square-warning', title: 'Retards d’envoi SMS', when: 'Ce matin', tone: 'n', status: 'Surveillance', meta: 'Opérateur SMS · délai moyen 4 min (normal : moins de 30 s)', description: 'Les OTP de connexion et les alertes d’absence arrivent avec du retard. Les utilisateurs peuvent redemander un code au bout de 60 secondes.', table: [['Type', 'Volume', 'Délai moyen', 'Échecs'], ['OTP connexion', '1 240', '3 min 50', '0,4 %'], ['Alertes absence', '612', '4 min 10', '0,2 %'], ['Annonces', '2 104', '5 min 30', '1,1 %']], action: 'Basculer sur l’opérateur de secours', actionIcon: 'repeat' },
  { id: 'i3', icon: 'upload', title: 'Import CSV interrompu', when: 'Hier', tone: 'hi', status: 'Résolu', meta: 'Lycée d’Owendo · fichier de 1 800 lignes', description: 'L’import s’est arrêté à la ligne 1 204 : délai dépassé. Il a été relancé automatiquement et s’est terminé avec succès.', table: [['Étape', 'Début', 'Fin', 'Lignes'], ['1er essai', '15:02', '15:07', '1 204'], ['Reprise auto', '15:09', '15:11', '596']], action: 'Voir le journal', actionIcon: 'file-text' },
];

/* ---- Import CSV d'élèves (étape de vérification) ---- */
export const CSV_TEMPLATE_COLUMNS = [
  { key: 'nom', required: true }, { key: 'prénom', required: true }, { key: 'téléphone', required: true },
  { key: 'classe', required: true }, { key: 'sexe', required: false }, { key: 'date de naissance', required: false },
];
export interface ImportRow { line: number; nom: string; prenom: string; phone: string; classe: string; error?: string }
export const IMPORT_PREVIEW: ImportRow[] = [
  { line: 2, nom: 'Mboumba', prenom: 'Ruth', phone: '+241 07 55 12 90', classe: '3ème B' },
  { line: 3, nom: 'Ndong', prenom: 'Samuel', phone: '+241 06 44 80 12', classe: '4ème A' },
  { line: 14, nom: 'Obame', prenom: 'Léa', phone: '07 7', classe: '5ème B', error: 'Numéro trop court' },
  { line: 27, nom: 'Mouketou', prenom: '', phone: '+241 07 31 66 02', classe: '6ème C', error: 'Prénom manquant' },
  { line: 58, nom: 'Eyeghe', prenom: 'Paul', phone: '+241 07 90 21 45', classe: '6ème Z', error: 'Classe inconnue' },
  { line: 101, nom: 'Ngoua', prenom: 'Mireille', phone: '+241 06 12 33 78', classe: 'Seconde A' },
];
export const IMPORT_TOTALS = { lines: 940, errors: 6 };

/* ---- Second établissement de démonstration : sert à vérifier le cloisonnement entre écoles ---- */
export const SECOND_SCHOOL_DIRECTOR: SessionUser = {
  id: 'u-ecole-2', name: 'Marc Obame', initials: 'MO', phone: '07000005', role: 'etablissement',
  title: `Direction · ${SECOND_SCHOOL_NAME}`, organization: SECOND_SCHOOL_NAME,
};
export const SECOND_SCHOOL_DATA = {
  classes: [
    { id: 'b6a', name: '6ème A', level: 'Collège' as const, capacity: 45, students: 40, completion: 66 },
    { id: 'b5a', name: '5ème A', level: 'Collège' as const, capacity: 45, students: 41, completion: 52 },
  ],
  students: [
    { id: 'bs1', firstName: 'Nadège', lastName: 'Bivigou', classId: 'b6a', phone: '07445566', code: '120045', parents: [['Alice Bivigou', 'mère']] as [string, string][] },
    { id: 'bs2', firstName: 'Kevin', lastName: 'Ayingone', classId: 'b5a', phone: '07556677', code: '230156', parents: [] as [string, string][] },
  ],
  teacher: { id: 'bt1', name: 'Hélène Mavoungou', phone: '+241 07 66 77 88', assignments: 'Français · 6ème A', status: 'Activé' as const },
  absence: { classId: 'b5a', studentId: 'bs2', date: '2026-11-10', status: 'A' as const, justification: null as string | null },
  announcement: { id: 'ban1', title: 'Réunion des parents', message: 'Réunion des parents de 6ème A le 18 novembre à 16 h.', audience: 'class', target: '6ème A' },
  case: { id: 'SC-0201', reporter: 'Enseignant · H. Mavoungou', className: '6ème A', type: 'Mal-être', received: 'hier, 10:15', student: 'Nadège Bivigou', text: 'L’élève s’isole depuis deux semaines et ne participe plus en classe.' },
};
