import type { NavItem } from '@sge/shared';
import { Shell } from '~/components/shell';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/layout';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'agent');
  // Menu et pastilles viennent de l'API (compteurs réels, jamais de valeurs figées).
  return { user: api.user, nav: await api.get<NavItem[]>('/nav') };
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  return <Shell space="agent" user={loaderData.user} nav={loaderData.nav} />;
}
