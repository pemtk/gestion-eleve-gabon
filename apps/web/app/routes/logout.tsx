import { redirect } from 'react-router';
import { publicApi } from '~/lib/api.server';
import { destroyUserSession, getSession } from '~/lib/session.server';
import type { Route } from './+types/logout';

export const loader = () => redirect('/');

/** Déconnexion : le jeton de renouvellement est révoqué côté API avant que le cookie ne soit détruit. */
export async function action({ request }: Route.ActionArgs) {
  const refreshToken = (await getSession(request)).get('refreshToken');
  if (refreshToken) await publicApi.post('/auth/logout', { refreshToken }).catch(() => undefined);
  return destroyUserSession(request);
}
