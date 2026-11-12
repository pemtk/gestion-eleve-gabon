import type { DashboardData } from '@sge/shared';
import { DashboardView } from '~/components/dashboard';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/dashboard';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  return api.get<DashboardData & { statsLocked: boolean }>('/dashboard/ecole');
}

export default function EcoleDashboard({ loaderData: d }: Route.ComponentProps) {
  return <DashboardView data={d} actionTo="/ecole/utilisateurs/import" statsLocked={d.statsLocked} />;
}
