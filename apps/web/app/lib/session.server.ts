import { AsyncLocalStorage } from 'node:async_hooks';
import { createCookieSessionStorage, redirect } from 'react-router';
import { ROLE_OF_SPACE, WEB_HOME, WEB_SPACE_OF, type SessionUser, type WebSpace } from '@sge/shared';

type SessionData = { token: string; refreshToken: string; user: SessionUser };

/** Jeton d'accès renouvelé pendant la requête en cours (le cookie n'est mis à jour qu'à la réponse) : tous les chargements de la page le partagent. */
export const renewed = new AsyncLocalStorage<{ token: string }>();

const secret = process.env.SESSION_SECRET ?? (process.env.NODE_ENV === 'production' ? '' : 'dev-only-session-secret');
if (!secret) throw new Error('SESSION_SECRET est obligatoire en production.');

export const sessions = createCookieSessionStorage<SessionData>({
  cookie: {
    name: '__sge_session',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14, // durée du jeton de renouvellement ; le jeton d'accès, lui, ne vit que 15 minutes
    secrets: [secret],
    secure: process.env.NODE_ENV === 'production',
  },
});

export async function getSession(request: Request) {
  return sessions.getSession(request.headers.get('Cookie'));
}

export async function createUserSession(token: string, refreshToken: string, user: SessionUser) {
  const session = await sessions.getSession();
  session.set('token', token);
  session.set('refreshToken', refreshToken);
  session.set('user', user);
  const space = WEB_SPACE_OF[user.role];
  return redirect(space ? WEB_HOME[space] : '/login', { headers: { 'Set-Cookie': await sessions.commitSession(session) } });
}

export async function destroyUserSession(request: Request) {
  return redirect('/login', { headers: { 'Set-Cookie': await sessions.destroySession(await getSession(request)) } });
}

/** Charge la session ; sans session valide pour l'espace demandé, retourne vers la connexion. */
export async function requireUser(request: Request, space: WebSpace) {
  const session = await getSession(request);
  const token = renewed.getStore()?.token ?? session.get('token');
  const user = session.get('user');
  if (!token || !user) throw redirect('/login');
  if (user.role !== ROLE_OF_SPACE[space]) {
    const own = WEB_SPACE_OF[user.role];
    throw redirect(own ? WEB_HOME[own] : '/login');
  }
  return { token, user };
}
