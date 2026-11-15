import { ROLE_PREFIX, useSession } from './session';

/** Préfixe des routes du profil connecté (« /parent », « /eleve » ou « /prof »). */
export function useRolePrefix(): string {
  return ROLE_PREFIX[useSession().user?.role ?? 'eleve'] ?? '/eleve';
}
