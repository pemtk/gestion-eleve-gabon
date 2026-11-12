import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/export-csv';

/** Ressource : relaie le CSV de l'API avec la session de l'utilisateur. */
export async function loader({ request }: Route.LoaderArgs) {
  const csv = await (await spaceApi(request, 'partenaire')).get<string>('/partner/export.csv');
  return new Response(`﻿${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="signalements.csv"' } });
}
