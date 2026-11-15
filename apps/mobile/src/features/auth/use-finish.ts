import { useRouter } from 'expo-router';
import { ROLE_LABELS } from '@sge/shared';
import { HOME, useSession } from '@/lib/session';
import type { Session } from './types';

/** Ouvre la session ; les profils web (établissement, agent…) sont invités à utiliser le site. */
export function useFinish() {
  const { signIn } = useSession();
  const router = useRouter();
  return async (s: Session): Promise<string | null> => {
    if (!HOME[s.user.role])
      return `Le profil ${ROLE_LABELS[s.user.role].toLowerCase()} utilise l’application web.`;
    await signIn(s.accessToken, s.refreshToken, s.user);
    router.replace(HOME[s.user.role] as '/');
    return null;
  };
}
