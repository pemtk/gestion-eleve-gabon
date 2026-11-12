import { Form, useSearchParams } from 'react-router';
import { Icon } from '~/components/icon';
import { PageHeader } from '~/components/blocks';
import { Kicker, LinkButton, Section, Select } from '~/components/ui';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/school';

type School = { name: string; kpis: { label: string; value: string; sub: string }[]; activation: [string, string, number][]; alerts: { icon: string; text: string }[]; entry: number; reports: { id: string; date: string; text: string }[] };
const NAMES = ['Lycée Léon Mba', 'Collège Bessieux', 'École Saint-Michel', 'Collège de Nzeng-Ayong', 'École Akébé-Plaine'];

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'agent');
  const name = new URL(request.url).searchParams.get('nom') ?? NAMES[0]!;
  return api.get<School>(`/agent/schools/${encodeURIComponent(name)}`);
}

export default function AgentSchool({ loaderData: s }: Route.ComponentProps) {
  const [, setParams] = useSearchParams();
  return (
    <>
      <PageHeader kicker="Mes écoles › Fiche" title={s.name} filters={[{ icon: 'calendar', label: 'Cette semaine' }]}
        action={<LinkButton to="/agent/comptes-rendus" icon="file-pen-line">Nouveau compte-rendu</LinkButton>} />
      <Form className="flex items-center gap-2 text-[13px] text-neutral-700"><label className="flex items-center gap-2">École
        <Select value={s.name} onChange={(e) => setParams({ nom: e.target.value })} className="!w-auto">{NAMES.map((n) => <option key={n}>{n}</option>)}</Select></label></Form>
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {s.kpis.map((k, i) => (
          <div key={k.label} className={`rounded-lg border p-4 ${i === 0 ? 'border-accent-300 bg-accent-100' : 'border-divider'}`}>
            <div className="text-[12.5px] text-neutral-700">{k.label}</div><div className="tnum font-heading text-[36px] leading-none">{k.value}</div><div className="text-[12px] text-neutral-600">{k.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Section title="Activation des comptes">
          {s.activation.map(([label, v, pct]) => (
            <div key={label} className="mb-3"><div className="mb-1 flex justify-between text-[13.5px]"><span>{label}</span><span className="tnum">{v}</span></div>
              <div className="h-2.5 overflow-hidden rounded-[2px] bg-neutral-200"><div className={`h-full border-r-[1.5px] border-accent-700 ${pct < 70 ? 'bg-accent-100' : 'bg-accent-300'}`} style={{ width: `${pct}%` }} /></div></div>
          ))}
          <Kicker className="mt-5">Saisie par les enseignants</Kicker>
          <div className="mt-1"><div className="tnum font-heading text-[34px] leading-none">{s.entry} %</div><div className="text-[13px] text-neutral-700">notes du trimestre saisies</div></div>
        </Section>
        <div className="flex flex-col gap-5">
          <Section title="Alertes">{s.alerts.map((a) => <div key={a.text} className="flex items-center gap-3 border-t border-divider py-2.5 text-[13.5px]"><Icon name={a.icon} size={16} className="text-accent-700" />{a.text}</div>)}</Section>
          <Section title="Comptes-rendus">{s.reports.length ? s.reports.map((r) => <div key={r.id} className="border-t border-divider py-2.5 text-[13.5px]"><b>{r.date}</b> · {r.text}</div>) : <p className="text-[13.5px] italic text-neutral-600">Aucun compte-rendu pour cette école.</p>}</Section>
        </div>
      </div>
    </>
  );
}
