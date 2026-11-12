import { WEB_NAV, planHas, type Plan } from '@sge/shared';
import { Shell } from '~/components/shell';
import { SuspendedBanner } from '~/components/blocks';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/layout';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  const [sub, profile] = await Promise.all([api.get<{ plan: Plan; suspended: boolean }>('/school/subscription'), api.get<{ name: string; badges: { users: number; absences: number; cases: number } }>('/school/profile')]);
  return {
    schoolName: profile.name,
    user: api.user,
    // Les pastilles viennent de l'établissement connecté (pas de valeurs figées).
    nav: WEB_NAV.ecole.map((n) => {
      const count = n.label === 'Utilisateurs' ? profile.badges.users : n.label === 'Absences' ? profile.badges.absences : n.label === 'Vie scolaire' ? profile.badges.cases : 0;
      return { ...n, badge: count ? String(count) : undefined };
    }),
    plan: sub.plan,
    suspended: sub.suspended,
    lockedNav: planHas(sub.plan).network ? [] : ['Vue réseau'],
  };
}

export default function EcoleLayout({ loaderData: d }: Route.ComponentProps) {
  return (
    <Shell space="ecole" user={d.user} nav={d.nav} banner={d.suspended ? <SuspendedBanner /> : undefined}
      school={{ name: d.schoolName, group: d.plan, plan: d.plan, suspended: d.suspended, lockedNav: d.lockedNav }} />
  );
}
