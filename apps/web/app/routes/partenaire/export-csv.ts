import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/export-csv';

/** Ressource : relaie le CSV de l'API avec la session de l'utilisateur (`?dataset=provinces` pour le tableau par région). */
export async function loader({ request }: Route.LoaderArgs) {
  const dataset = new URL(request.url).searchParams.get('dataset') === 'provinces' ? 'provinces' : 'signalements';
  const csv = await (await spaceApi(request, 'partenaire')).get<string>(`/partner/export.csv?dataset=${dataset}`);
  return new Response(`\ufeff${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${dataset}.csv"` } });
}
