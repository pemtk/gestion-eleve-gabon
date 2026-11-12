/** Les 7 profils du manuel utilisateur et leurs droits d'accès (annexe 13.2). */
export const ROLES = [
  'eleve',
  'parent',
  'enseignant',
  'etablissement',
  'agent',
  'partenaire',
  'admin',
] as const;
export type Role = (typeof ROLES)[number];

export type Support = 'mobile' | 'web';

export const ROLE_LABELS: Record<Role, string> = {
  eleve: 'Élève',
  parent: 'Parent',
  enseignant: 'Enseignant',
  etablissement: 'Établissement',
  agent: 'Agent',
  partenaire: 'Partenaire institutionnel',
  admin: 'Administrateur plateforme',
};

/** Support principal : l'enseignant dispose des deux. */
export const ROLE_SUPPORTS: Record<Role, Support[]> = {
  eleve: ['mobile'],
  parent: ['mobile'],
  enseignant: ['mobile', 'web'],
  etablissement: ['web'],
  agent: ['web'],
  partenaire: ['web'],
  admin: ['web'],
};

export const MOBILE_ROLES: Role[] = ROLES.filter((r) => ROLE_SUPPORTS[r].includes('mobile'));
export const WEB_ROLES: Role[] = ROLES.filter((r) => ROLE_SUPPORTS[r].includes('web'));

/** Espaces web (un par profil institutionnel). */
export type WebSpace = 'ecole' | 'agent' | 'partenaire' | 'admin';
export const WEB_SPACE_OF: Partial<Record<Role, WebSpace>> = {
  etablissement: 'ecole',
  agent: 'agent',
  partenaire: 'partenaire',
  admin: 'admin',
};
export const ROLE_OF_SPACE: Record<WebSpace, Role> = {
  ecole: 'etablissement',
  agent: 'agent',
  partenaire: 'partenaire',
  admin: 'admin',
};

export type Access = 'oui' | 'non' | 'soi' | 'ses-enfants' | 'sa-classe' | 'agrege' | 'ouvrir' | 'traiter' | 'metadonnees';

export type Capability =
  | 'tasks.read'
  | 'activity.read'
  | 'grades.read'
  | 'tasks.write'
  | 'grades.write'
  | 'reports.confidential'
  | 'subscriptions.manage';

const O: Access = 'oui';
const N: Access = 'non';

/** Annexe 13.2 — « Droits d'accès par profil ». */
export const ACCESS_MATRIX: Record<Capability, Record<Role, Access>> = {
  'tasks.read': { eleve: O, parent: N, enseignant: 'sa-classe', etablissement: O, agent: N, partenaire: N, admin: N },
  'activity.read': { eleve: 'soi', parent: 'ses-enfants', enseignant: 'sa-classe', etablissement: O, agent: 'agrege', partenaire: 'agrege', admin: 'agrege' },
  'grades.read': { eleve: 'soi', parent: 'ses-enfants', enseignant: 'sa-classe', etablissement: O, agent: 'agrege', partenaire: 'agrege', admin: N },
  'tasks.write': { eleve: N, parent: N, enseignant: 'sa-classe', etablissement: O, agent: N, partenaire: N, admin: N },
  'grades.write': { eleve: N, parent: N, enseignant: O, etablissement: O, agent: N, partenaire: N, admin: N },
  'reports.confidential': { eleve: N, parent: 'ouvrir', enseignant: 'ouvrir', etablissement: 'traiter', agent: N, partenaire: N, admin: 'metadonnees' },
  'subscriptions.manage': { eleve: N, parent: N, enseignant: N, etablissement: N, agent: N, partenaire: N, admin: O },
};

export function can(role: Role, capability: Capability): boolean {
  return ACCESS_MATRIX[capability][role] !== 'non';
}

/** Page d'accueil de chaque profil dans l'application web. */
export const WEB_HOME: Record<WebSpace, string> = {
  ecole: '/ecole',
  agent: '/agent',
  partenaire: '/partenaire',
  admin: '/admin',
};
