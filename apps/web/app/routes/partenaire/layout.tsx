import { WEB_NAV } from '@sge/shared';
import { Shell } from '~/components/shell';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/layout';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'partenaire');
  return { user: api.user, nav: WEB_NAV.partenaire };
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  return <Shell space="partenaire" user={loaderData.user} nav={loaderData.nav}  />;
}
