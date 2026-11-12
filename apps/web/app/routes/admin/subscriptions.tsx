import { Form, useFetcher } from 'react-router';
import { PLANS, type Organization, type Plan } from '@sge/shared';
import { Icon } from '~/components/icon';
import { Cell, PageHeader } from '~/components/blocks';
import { ActionNotice, Button, Notice, Section, Select } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import type { Route } from './+types/subscriptions';

type Row = Organization & { period: 'mensuelle' | 'annuelle'; active: boolean };
type Data = { rows: Row[]; requests: { organizationId: string; organization: string; from: Plan; to: Plan }[] };

export async function loader({ request }: Route.LoaderArgs) {
  return (await spaceApi(request, 'admin')).get<Data>('/admin/subscriptions');
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'admin');
  const fd = await request.formData();
  const intent = str(fd, 'intent');
  if (intent === 'apply' || intent === 'refuse') return run(() => api.post(`/admin/subscriptions/${str(fd, 'orgId')}/request/${intent}`), intent === 'apply' ? 'Formule appliquée. L’établissement est prévenu.' : 'Demande refusée. L’établissement est prévenu.');
  const toggle = intent === 'toggle';
  return run(() => api.put(`/admin/subscriptions/${str(fd, 'id')}`, { plan: str(fd, 'plan'), period: str(fd, 'period'), start: '2026-01-01', end: '2026-12-31', active: toggle ? str(fd, 'active') === 'true' : str(fd, 'wasActive') === 'true' }), toggle ? 'Abonnement mis à jour.' : 'Formule modifiée.');
}

export default function Subscriptions({ loaderData: d, actionData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader kicker="Abonnements" title="Formules et périodes" filters={[{ icon: 'filter', label: 'Toutes les organisations' }]} />
      <ActionNotice result={actionData ?? undefined} />
      {d.requests.map((r) => (
        <Notice key={r.organizationId} tone="info">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex-1">Demande reçue : le {r.organization} souhaite passer de la formule {r.from} à la formule {r.to}.</span>
            <Form method="post" className="flex gap-2"><input type="hidden" name="orgId" value={r.organizationId} /><Button type="submit" name="intent" value="refuse" variant="secondary">Refuser</Button><Button type="submit" name="intent" value="apply">Appliquer</Button></Form>
          </div>
        </Notice>
      ))}
      <Section className="overflow-x-auto !p-0">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[1.8fr_.8fr_1.1fr_.9fr_.9fr_1fr] border-b border-divider px-2 text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            {['Organisation', 'Type', 'Formule', 'Période', 'Statut', ''].map((h, i) => <div key={i} className="px-2 py-2.5">{h}</div>)}
          </div>
          {d.rows.map((r) => <SubRow key={r.id} r={r} />)}
        </div>
      </Section>
    </>
  );
}

function SubRow({ r }: { r: Row }) {
  const f = useFetcher();
  return (
    <f.Form method="post" className="grid grid-cols-[1.8fr_.8fr_1.1fr_.9fr_.9fr_1fr] items-center border-b border-divider px-2 py-2 text-[13.5px]">
      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="period" value={r.period} /><input type="hidden" name="wasActive" value={String(r.active)} />
      <div className="px-2">{r.name}</div><div className="px-2">{r.type}</div>
      <div className="px-1"><Select name="plan" defaultValue={r.plan} aria-label={`Formule de ${r.name}`} className="!min-h-8 !text-[13px]" onChange={(e) => f.submit(e.currentTarget.form)}>{PLANS.map((p) => <option key={p}>{p}</option>)}</Select></div>
      <div className="px-2 capitalize">{r.period}</div>
      <div className="px-2"><Cell>{r.active ? 'Actif' : 'Suspendu'}</Cell></div>
      <div className="px-1">
        <Button type="submit" name="intent" value="toggle" variant="ghost" className="whitespace-nowrap" aria-label={`${r.active ? 'Suspendre' : 'Activer'} ${r.name}`}
          onClick={(e) => { const form = e.currentTarget.form!; (form.elements.namedItem('wasActive') as HTMLInputElement).value = String(r.active); }}>
          <Icon name={r.active ? 'circle-pause' : 'play'} size={14} />{r.active ? 'Suspendre' : 'Activer'}
        </Button>
        <input type="hidden" name="active" value={String(!r.active)} />
      </div>
    </f.Form>
  );
}
