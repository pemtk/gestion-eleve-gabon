import type { DashboardData } from '@sge/shared';
import { LockedCard, PageHeader } from '~/components/blocks';
import { DashboardView } from '~/components/dashboard';
import { ApiError, spaceApi } from '~/lib/api.server';
import { useSchoolName } from '~/lib/school';
import type { Route } from './+types/network';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  try {
    return { locked: false as const, data: await api.get<DashboardData>('/dashboard/ecole/network') };
  } catch (e) {
    if (e instanceof ApiError && e.code === 'PLAN_REQUIRED') return { locked: true as const };
    throw e;
  }
}

export default function Network({ loaderData: d }: Route.ComponentProps) {
  const school = useSchoolName();
  if (d.locked) {
    return (
      <>
        <PageHeader kicker={`${school} · réseau`} title="Vue réseau" />
        <LockedCard plan="Réseau" title="Comparer plusieurs établissements"
          text="La vue réseau rassemble les établissements d’un diocèse ou d’un réseau : complétion, activation des parents, absences et alertes, côte à côte." />
      </>
    );
  }
  return <DashboardView data={{ ...d.data, head: { ...d.data.head, kicker: `${school} · réseau`, title: 'Vue réseau' } }} />;
}
