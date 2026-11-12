import { useState } from 'react';
import { useFetcher } from 'react-router';
import type { TechIncident } from '@sge/shared';
import { Icon } from '~/components/icon';
import { PageHeader } from '~/components/blocks';
import { Button, ActionNotice, Section, Tag, cx, type Tone } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import type { Route } from './+types/incidents';

export async function loader({ request }: Route.LoaderArgs) {
  return { incidents: await (await spaceApi(request, 'admin')).get<TechIncident[]>('/admin/incidents') };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'admin');
  const fd = await request.formData();
  if (str(fd, 'intent') === 'resolve') return run(() => api.post(`/admin/incidents/${str(fd, 'id')}/resolve`), 'Incident marqué comme résolu.');
  return run(async () => undefined, `${str(fd, 'label')} : demande envoyée.`);
}

export default function Incidents({ loaderData: d, actionData }: Route.ComponentProps) {
  const [sel, setSel] = useState(0);
  const f = useFetcher();
  const inc = d.incidents[sel] ?? d.incidents[0]!;
  return (
    <>
      <PageHeader kicker="Supervision technique" title="Incidents" filters={[{ icon: 'calendar', label: '7 derniers jours' }]} />
      <ActionNotice result={(f.data ?? actionData) ?? undefined} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="flex flex-col gap-2">
          {d.incidents.map((x, i) => (
            <button key={x.id} type="button" aria-pressed={i === sel} onClick={() => setSel(i)} className={cx('flex items-center gap-3 rounded-lg border p-3.5 text-left', i === sel ? 'border-accent-300 bg-accent-100 ring-1 ring-accent-300' : 'border-divider hover:bg-neutral-100')}>
              <Icon name={x.icon} size={18} className="flex-none text-accent-700" />
              <span className="min-w-0 flex-1 text-[14px]"><span className="block font-semibold">{x.title}</span><span className="text-[12px] text-neutral-600">{x.when}</span></span>
              <Tag tone={(x.status === 'Résolu' ? 'hi' : x.tone) as Tone}>{x.status}</Tag>
            </button>
          ))}
        </div>
        <Section>
          <div className="flex items-start justify-between gap-3"><h2 className="text-[26px]">{inc.title}</h2><Tag tone={(inc.status === 'Résolu' ? 'hi' : inc.tone) as Tone}>{inc.status}</Tag></div>
          <p className="mt-1 text-[12.5px] text-neutral-600">{inc.meta}</p>
          <p className="mt-3 text-[14px] leading-relaxed text-neutral-800">{inc.description}</p>
          <div className="mt-4 overflow-x-auto">
            {inc.table.map((row, ri) => (
              <div key={ri} className={cx('grid gap-2 border-b border-divider py-2 text-[13px]', ri === 0 && 'text-[11px] tracking-[.08em] text-neutral-600 uppercase')} style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                {row.map((c, ci) => <div key={ci} className="tnum">{c}</div>)}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <f.Form method="post"><input type="hidden" name="label" value={inc.action} /><Button type="submit" icon={inc.actionIcon}>{inc.action}</Button></f.Form>
            {inc.status !== 'Résolu' && <f.Form method="post"><input type="hidden" name="intent" value="resolve" /><input type="hidden" name="id" value={inc.id} /><Button type="submit" variant="secondary" icon="check">Marquer comme résolu</Button></f.Form>}
          </div>
        </Section>
      </div>
    </>
  );
}
