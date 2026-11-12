import type { DashboardData } from '@sge/shared';
import { DashboardView } from '~/components/dashboard';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/dashboard';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'agent');
  return api.get<DashboardData>('/dashboard/agent');
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  return <DashboardView data={loaderData} actionTo="/agent/comptes-rendus" />;
}
