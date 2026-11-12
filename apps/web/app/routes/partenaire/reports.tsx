import { Cell, DataGrid, PageHeader } from '~/components/blocks';
import { Notice } from '~/components/ui';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/reports';

type Data = { threshold: number; rows: { type: string; open: number | null; inProgress: number | null; closed: number | null }[] };

export async function loader({ request }: Route.LoaderArgs) {
  return (await spaceApi(request, 'partenaire')).get<Data>('/partner/reports');
}

export default function PartnerReports({ loaderData: d }: Route.ComponentProps) {
  const v = (n: number | null) => (n === null ? 'masqué' : String(n));
  return (
    <>
      <PageHeader kicker="Données agrégées et anonymisées" title="Signalements" />
      <Notice tone="info">Les signalements sont comptés par type et statut, sans aucun détail nominatif. Cellules de moins de {d.threshold} masquées.</Notice>
      <DataGrid title="Signalements par type et statut" note="année en cours" columns="1.6fr 1fr 1fr 1fr" head={['Type', 'Ouverts', 'En cours', 'Clos']}
        rows={d.rows.map((r) => [r.type, ...[r.open, r.inProgress, r.closed].map((n, i) => <Cell key={i}>{v(n)}</Cell>)])} />
    </>
  );
}
