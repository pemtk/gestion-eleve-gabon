import { redirect } from 'react-router';
import { WEB_HOME, WEB_SPACE_OF } from '@sge/shared';
import { getSession } from '~/lib/session.server';
import type { Route } from './+types/home';

export async function loader({ request }: Route.LoaderArgs) {
  const user = (await getSession(request)).get('user');
  const space = user && WEB_SPACE_OF[user.role];
  throw redirect(space ? WEB_HOME[space] : '/login');
}
