import type { NavItem } from '@sge/shared';
import { Shell } from '~/components/shell';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/layout';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'enseignant');
  return { user: api.user, nav: await api.get<NavItem[]>('/nav') };
}

/** Espace enseignant : menu latéral et zone de contenu. */
export default function Layout({ loaderData }: Route.ComponentProps) {
  return <Shell space="enseignant" user={loaderData.user} nav={loaderData.nav} />;
}
