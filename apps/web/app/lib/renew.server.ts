import type { MiddlewareFunction } from 'react-router';
import type { SessionUser } from '@sge/shared';
import { ApiError, publicApi } from './api.server';
import { renewed, sessions, getSession } from './session.server';

type Renewal = { accessToken: string; refreshToken: string; user: SessionUser };

/** Millisecondes avant l'expiration du jeton d'accès (lue dans sa charge, sans vérifier la signature : c'est l'API qui la vérifie). */
function msLeft(token: string): number {
  try {
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as { exp?: number };
    return exp ? exp * 1000 - Date.now() : 0;
  } catch {
    return 0;
  }
}

/**
 * Middleware racine : renouvelle la session avant les chargements quand le jeton d'accès expire dans moins de 2 minutes.
 * Le nouveau jeton sert tout de suite aux appels de la requête et part dans le cookie de la réponse ; les jetons ne sont
 * jamais visibles du navigateur (cookie httpOnly). Si le renouvellement échoue, la requête continue : l'API répondra 401
 * et l'utilisateur sera renvoyé vers la connexion.
 */
export const renewSession: MiddlewareFunction<Response> = async ({ request }, next) => {
  const session = await getSession(request);
  const token = session.get('token');
  const refreshToken = session.get('refreshToken');
  if (!token || !refreshToken || msLeft(token) > 2 * 60_000) return next();
  let fresh: Renewal;
  try {
    fresh = await publicApi.post<Renewal>('/auth/refresh', { refreshToken });
  } catch (e) {
    if (e instanceof ApiError) return next();
    throw e;
  }
  session.set('token', fresh.accessToken);
  session.set('refreshToken', fresh.refreshToken);
  session.set('user', fresh.user);
  const cookie = await sessions.commitSession(session);
  const response = await renewed.run({ token: fresh.accessToken }, () => next());
  response.headers.append('Set-Cookie', cookie);
  return response;
};
