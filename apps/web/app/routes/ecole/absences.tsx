import { useState } from 'react';
import { useFetcher, useSearchParams } from 'react-router';
import { JUSTIFICATIONS, type AttendanceStatus } from '@sge/shared';
import { Icon } from '~/components/icon';
import { Button, LinkButton, Section, Select, Tag } from '~/components/ui';
import { PageHeader } from '~/components/blocks';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import type { AbsenceRow, SubscriptionInfo } from '~/lib/types';
import type { Route } from './+types/absences';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  const [rows, sub] = await Promise.all([api.get<AbsenceRow[]>('/school/absences'), api.get<SubscriptionInfo>('/school/subscription')]);
  const classe = new URL(request.url).searchParams.get('classe') ?? '';
  return { rows: classe ? rows.filter((r) => r.className === classe) : rows, classNames: [...new Set(rows.map((r) => r.className))], classe, exportOk: sub.features.stats };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  const justification = str(fd, 'justification');
  return run(() => api.patch(`/school/absences/${str(fd, 'id')}`, { status: str(fd, 'status'), justification: justification || null }), 'Absence mise à jour.');
}

const LABEL: Record<AttendanceStatus, string> = { P: 'Présent', A: 'Absent', R: 'En retard' };

export default function Absences({ loaderData: d }: Route.ComponentProps) {
  const [, setParams] = useSearchParams();
  const exportCsv = () => {
    const csv = ['élève;classe;date;statut;justification', ...d.rows.map((r) => [r.student, r.className, r.date, LABEL[r.status], r.justification ?? ''].join(';'))].join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv' })), download: 'absences.csv' });
    a.click();
  };
  return (
    <>
      <PageHeader kicker="Vie scolaire" title="Absences et retards"
        filters={[{ icon: 'calendar', label: '9 – 10 nov.' }]}
        action={d.exportOk ? <Button variant="secondary" icon="download" onClick={exportCsv}>Exporter</Button> : <LinkButton variant="secondary" icon="lock" to="/ecole/abonnement">Exporter (formule Standard)</LinkButton>} />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-neutral-700">Classe
          <Select value={d.classe} onChange={(e) => setParams(e.target.value ? { classe: e.target.value } : {})} className="!w-auto">
            <option value="">Toutes les classes</option>{d.classNames.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </label>
        <span className="text-[13px] text-neutral-600">{d.rows.length} saisies par les enseignants</span>
      </div>
      <Section className="overflow-x-auto !p-0">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[1.4fr_.9fr_.8fr_1fr_1.4fr_.5fr] border-b border-divider px-2 text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            {['Élève', 'Classe', 'Date', 'Statut', 'Justification', ''].map((h, i) => <div key={i} className="px-2 py-2.5">{h}</div>)}
          </div>
          {d.rows.map((r) => <Row key={r.id} r={r} />)}
          {!d.rows.length && <div className="px-5 py-8 text-center italic text-neutral-600">Aucune absence pour cette sélection.</div>}
        </div>
      </Section>
    </>
  );
}

function Row({ r }: { r: AbsenceRow }) {
  const f = useFetcher<{ ok: boolean; error?: string }>();
  const [edit, setEdit] = useState(false);
  const cols = 'grid grid-cols-[1.4fr_.9fr_.8fr_1fr_1.4fr_.5fr] items-center border-b border-divider px-2 py-2 text-[13.5px]';
  if (edit) {
    return (
      <f.Form method="post" onSubmit={() => setEdit(false)} className={cols}>
        <input type="hidden" name="id" value={r.id} />
        <div className="px-2">{r.student}</div><div className="px-2">{r.className}</div><div className="px-2">{r.date}</div>
        <div className="px-1"><Select name="status" defaultValue={r.status} aria-label="Statut" className="!min-h-8 !text-[13px]">{(['P', 'A', 'R'] as const).map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}</Select></div>
        <div className="px-1"><Select name="justification" defaultValue={r.justification ?? ''} aria-label="Justification" className="!min-h-8 !text-[13px]"><option value="">Non justifié</option>{JUSTIFICATIONS.map((j) => <option key={j}>{j}</option>)}</Select></div>
        <div className="flex px-1"><Button type="submit" variant="ghost" aria-label="Enregistrer"><Icon name="check" size={16} /></Button></div>
      </f.Form>
    );
  }
  return (
    <div className={cols}>
      <div className="px-2">{r.student}</div><div className="px-2">{r.className}</div><div className="px-2">{r.date}</div>
      <div className="px-2"><Tag tone={r.status === 'A' ? 'warn' : 'n'}>{LABEL[r.status]}</Tag></div>
      <div className={r.justification ? 'px-2' : 'px-2 italic text-accent-800'}>{r.justification ?? 'Non justifié'}</div>
      <div className="px-1"><Button variant="ghost" aria-label={`Modifier l’absence de ${r.student}`} onClick={() => setEdit(true)}><Icon name="pencil" size={15} /></Button></div>
    </div>
  );
}
