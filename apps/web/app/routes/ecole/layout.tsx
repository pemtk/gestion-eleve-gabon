import { planHas, type NavItem, type Plan } from '@sge/shared';
import { Shell } from '~/components/shell';
import { SuspendedBanner } from '~/components/blocks';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/layout';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  const [sub, profile, nav] = await Promise.all([
    api.get<{ plan: Plan; suspended: boolean }>('/school/subscription'),
    api.get<{ name: string }>('/school/profile'),
    // Menu et pastilles viennent de l'API (compteurs de l'établissement connecté, jamais de valeurs figées).
    api.get<NavItem[]>('/nav'),
  ]);
  return {
    schoolName: profile.name,
    user: api.user,
    nav,
    plan: sub.plan,
    suspended: sub.suspended,
    lockedNav: planHas(sub.plan).network ? [] : ['Vue réseau'],
  };
}

export default function EcoleLayout({ loaderData: d }: Route.ComponentProps) {
  return (
    <Shell
      space="ecole"
      user={d.user}
      nav={d.nav}
      banner={d.suspended ? <SuspendedBanner /> : undefined}
      school={{
        name: d.schoolName,
        group: d.plan,
        plan: d.plan,
        suspended: d.suspended,
        lockedNav: d.lockedNav,
      }}
    />
  );
}
