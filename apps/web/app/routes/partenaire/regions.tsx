import { useSearchParams } from 'react-router';
import { PRIVACY_THRESHOLD } from '@sge/shared';
import { Cell, DataGrid, PageHeader } from '~/components/blocks';
import { Chips, Field, Notice } from '~/components/ui';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/regions';

type Data = { threshold: number; rows: { province: string; schools: number; cells: (string | null)[] }[] };

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'partenaire');
  const q = new URL(request.url).searchParams;
  return api.get<Data>(`/partner/provinces?region=${encodeURIComponent(q.get('region') ?? 'Toutes')}&level=${encodeURIComponent(q.get('level') ?? 'Tous')}`);
}

export default function Regions({ loaderData: d }: Route.ComponentProps) {
  const [params, setParams] = useSearchParams();
  const set = (k: string) => (v: string) => setParams((p) => { p.set(k, v); return p; }, { preventScrollReset: true });
  return (
    <>
      <PageHeader kicker="Données agrégées et anonymisées" title="Indicateurs par province" />
      <div className="flex flex-wrap gap-6">
        <Field label="Région"><Chips name="region" options={['Toutes', 'Estuaire', 'Intérieur']} value={params.get('region') ?? 'Toutes'} onChange={set('region')} /></Field>
        <Field label="Niveau"><Chips name="level" options={['Tous', 'Primaire', 'Collège', 'Lycée']} value={params.get('level') ?? 'Tous'} onChange={set('level')} /></Field>
      </div>
      <Notice tone="info">Si une cellule contient moins de {PRIVACY_THRESHOLD} individus, la donnée est masquée pour préserver la confidentialité.</Notice>
      <DataGrid title="Par province" note="30 derniers jours" columns="1.6fr .8fr 1fr 1fr 1fr 1fr" head={['Province', 'Écoles', 'Activation', 'Complétion', 'Présence', 'Signalements']}
        rows={d.rows.map((r) => [<span key="p" className="text-[14.5px]">{r.province}</span>, String(r.schools), ...r.cells.map((c, i) => <Cell key={i}>{c ?? 'masqué'}</Cell>)])} />
    </>
  );
}
