import type { Role } from './roles.js';

/** Usages d'un fichier : chacun a ses types, sa taille maximale et les profils qui peuvent le téléverser. */
export const FILE_KINDS = ['proof', 'avatar', 'attachment', 'report', 'message'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MB = 1024 * 1024;

export interface FilePolicy {
  label: string;
  maxBytes: number;
  types: readonly string[];
  roles: readonly Role[];
}

export const FILE_POLICIES: Record<FileKind, FilePolicy> = {
  /** Photo du cahier ou du devoir, jointe à la validation d'une tâche (§4.3, §11.3). */
  proof: { label: 'Photo de preuve', maxBytes: 5 * MB, types: IMAGE_TYPES, roles: ['eleve'] },
  /** Photo de profil (§3.4). */
  avatar: { label: 'Photo de profil', maxBytes: 2 * MB, types: IMAGE_TYPES, roles: ['eleve', 'parent', 'enseignant'] },
  /** Pièce jointe d'une annonce (§7.9). */
  attachment: { label: 'Pièce jointe', maxBytes: 5 * MB, types: [...IMAGE_TYPES, 'application/pdf'], roles: ['etablissement'] },
  /** Photo ou document joint à un compte-rendu de visite (§8.3). */
  report: { label: 'Pièce jointe du compte-rendu', maxBytes: 10 * MB, types: [...IMAGE_TYPES, 'application/pdf'], roles: ['agent'] },
  /** Image d'un message (§3.3 : « une image simple »). */
  message: { label: 'Image de message', maxBytes: 3 * MB, types: IMAGE_TYPES, roles: ['eleve', 'parent', 'enseignant'] },
};

/** Taille la plus grande tous usages confondus : plafond de lecture d'un envoi. */
export const MAX_UPLOAD_BYTES = Math.max(...Object.values(FILE_POLICIES).map((p) => p.maxBytes));

export interface StoredFile {
  id: string;
  kind: FileKind;
  name: string;
  contentType: string;
  size: number;
}

export const formatBytes = (n: number): string => (n >= MB ? `${(n / MB).toFixed(n % MB ? 1 : 0).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);

/** Libellé lisible des types acceptés pour un usage (« JPEG, PNG, WebP ou PDF »). */
export function acceptedTypes(kind: FileKind): string {
  const names = FILE_POLICIES[kind].types.map((t) => ({ 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'application/pdf': 'PDF' })[t] ?? t);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} ou ${names.at(-1)}` : names[0]!;
}
