import { redirect } from 'react-router';
import { WEB_SPACE_OF } from '@sge/shared';
import { spaceApi } from '~/lib/api.server';
import { getSession } from '~/lib/session.server';
import type { Route } from './+types/fichier';

/**
 * Ressource : relaie un fichier de l'API avec la session de l'utilisateur. Les droits sont ceux de l'API (404 si le fichier n'est pas
 * le sien) ; le navigateur n'a jamais de jeton ni de lien direct vers le stockage.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = (await getSession(request)).get('user');
  const space = user && WEB_SPACE_OF[user.role];
  if (!space) throw redirect('/login');
  const res = await (await spaceApi(request, space)).raw(`/files/${encodeURIComponent(params.id)}`);
  if (!res.ok)
    throw new Response('Fichier introuvable.', { status: res.status === 404 ? 404 : 502 });
  const headers = new Headers({
    'Cache-Control': 'private, max-age=60',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  for (const h of ['content-type', 'content-disposition', 'content-length']) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(res.body, { status: 200, headers });
}
