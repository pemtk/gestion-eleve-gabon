import { useState } from 'react';
import { useFetcher, useSearchParams } from 'react-router';
import { formatGrade } from '@sge/shared';
import { EmptyState, PageHeader } from '~/components/blocks';
import { Button, Dialog, Field, Input, Notice, Section, Select, Tag, Textarea } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import type { Route } from './+types/results';

type Result = { id: string | null; student: string; value: number | null; coefficient: number; published: boolean; history: { from: number; to: number; reason: string }[] };
type Data = { evaluations: { id: string; label: string; subject: string; trimester: string; className: string }[]; evaluationId: string | null; className: string; subject: string; term: string; evaluation: string; average: number | null; rows: Result[] };

export async function loader({ request }: Route.LoaderArgs) {
  const evaluation = new URL(request.url).searchParams.get('evaluation');
  return (await spaceApi(request, 'ecole')).get<Data>(`/school/results${evaluation ? `?evaluation=${encodeURIComponent(evaluation)}` : ''}`);
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  const value = Number(str(fd, 'value').replace(',', '.'));
  return run(() => api.post(`/school/results/${str(fd, 'id')}/correct`, { value, reason: str(fd, 'reason') }), 'Note corrigée : l’élève et le parent la voient tout de suite.');
}

export default function Results({ loaderData: d }: Route.ComponentProps) {
  const [target, setTarget] = useState<Result | null>(null);
  const f = useFetcher<{ ok: boolean; error?: string; message?: string }>();
  const [, setParams] = useSearchParams();
  if (!d.evaluationId) {
    return (
      <>
        <PageHeader kicker="Résultats › Notes" title="Résultats" />
        <Section><EmptyState icon="award" title="Aucune note publiée" text="Les notes apparaissent ici dès qu’un enseignant les publie depuis son application." /></Section>
      </>
    );
  }
  return (
    <>
      <PageHeader kicker="Résultats › Notes" title={`${d.subject} · ${d.className}`} filters={[{ icon: 'school', label: d.className }, { icon: 'calendar', label: d.term }]} />
      <label className="flex items-center gap-2 text-[13px] text-neutral-700">Évaluation
        <Select value={d.evaluationId} onChange={(e) => setParams({ evaluation: e.target.value })} className="!w-auto">
          {d.evaluations.map((e) => <option key={e.id} value={e.id}>{e.className} · {e.subject} · {e.label}</option>)}
        </Select>
      </label>
      {f.data?.ok && <Notice>{f.data.message}</Notice>}
      <Section title={d.evaluation} note={<>Moyenne de la classe <span className="tnum font-heading text-[20px] text-text">{d.average === null ? '–' : formatGrade(d.average)}</span> /20</>} className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[1.6fr_.8fr_.8fr_1.2fr_.7fr] border-b border-divider text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            {['Élève', 'Note', 'Coef.', 'État', ''].map((h, i) => <div key={i} className="px-2 py-2.5">{h}</div>)}
          </div>
          {d.rows.map((r) => (
            <div key={r.id ?? r.student} className="grid grid-cols-[1.6fr_.8fr_.8fr_1.2fr_.7fr] items-center border-b border-divider text-[13.5px]">
              <div className="px-2 py-2.5">{r.student}</div>
              <div className="tnum px-2 font-heading text-[20px]">{r.value === null ? '–' : <>{formatGrade(r.value)}<span className="text-[13px] text-neutral-600">/20</span></>}</div>
              <div className="tnum px-2">{r.coefficient}</div>
              <div className="px-2">{r.value === null ? <Tag>Non saisie</Tag> : r.history.length ? <Tag tone="warn">Corrigée</Tag> : <Tag tone="hi">Publiée</Tag>}</div>
              <div className="px-2">{r.value !== null && r.id && <Button variant="ghost" onClick={() => setTarget(r)}>Corriger</Button>}</div>
            </div>
          ))}
        </div>
      </Section>

      <Dialog open={!!target} title={`Corriger la note de ${target?.student ?? ''}`} onClose={() => setTarget(null)}>
        <f.Form method="post" onSubmit={() => setTarget(null)} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={target?.id ?? ''} />
          <p className="text-[13.5px] text-neutral-700">Note publiée : <span className="tnum font-semibold">{target?.value === null || !target ? '–' : formatGrade(target.value)}/20</span>. La correction est immédiatement visible par l’élève et le parent.</p>
          <Field label="Nouvelle note (sur 20)"><Input name="value" inputMode="decimal" required className="tnum" autoFocus /></Field>
          <Field label="Motif de la correction (obligatoire)"><Textarea name="reason" required minLength={3} placeholder="Ex. Erreur de saisie" /></Field>
          {f.data && !f.data.ok && <Notice tone="error">{f.data.error}</Notice>}
          <div className="mt-1 flex justify-end gap-2"><Button variant="secondary" onClick={() => setTarget(null)}>Annuler</Button><Button type="submit" icon="check">Corriger</Button></div>
        </f.Form>
      </Dialog>
    </>
  );
}
