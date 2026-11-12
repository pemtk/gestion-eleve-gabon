import { WEB_NAV } from '@sge/shared';
import { Shell } from '~/components/shell';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/layout';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'agent');
  return { user: api.user, nav: WEB_NAV.agent };
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  return <Shell space="agent" user={loaderData.user} nav={loaderData.nav}  />;
}
