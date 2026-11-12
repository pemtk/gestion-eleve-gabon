import { WEB_NAV, planHas, type Plan } from '@sge/shared';
import { Shell } from '~/components/shell';
import { SuspendedBanner } from '~/components/blocks';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/layout';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  const sub = await api.get<{ plan: Plan; suspended: boolean }>('/school/subscription');
  return {
    user: api.user,
    nav: WEB_NAV.ecole,
    plan: sub.plan,
    suspended: sub.suspended,
    lockedNav: planHas(sub.plan).network ? [] : ['Vue réseau'],
  };
}

export default function EcoleLayout({ loaderData: d }: Route.ComponentProps) {
  return (
    <Shell space="ecole" user={d.user} nav={d.nav} banner={d.suspended ? <SuspendedBanner /> : undefined}
      school={{ name: 'Lycée Léon Mba', group: 'Libreville', plan: d.plan, suspended: d.suspended, lockedNav: d.lockedNav }} />
  );
}
