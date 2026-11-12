import { useState } from 'react';
import { useFetcher } from 'react-router';
import { CASE_STEPS, type ConfidentialCase } from '@sge/shared';
import { Icon } from '~/components/icon';
import { LinkButton, Button, Chips, Field, Notice, Section, Textarea, Toggle, Input, cx } from '~/components/ui';
import { PageHeader } from '~/components/blocks';
import { run, spaceApi } from '~/lib/api.server';
import { flag, str } from '~/lib/form';
import type { Route } from './+types/case';

type State = { step: 1 | 2 | 3 | 4 | 5; gravity?: string; actions: { label: string; owner: string; due: string; done: boolean }[]; log: { at: string; event: string }[] };

export async function loader({ request, params }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  return api.get<{ info: ConfidentialCase; state: State }>(`/school/cases/${encodeURIComponent(params.caseId)}`);
}

export async function action({ request, params }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  const base = `/school/cases/${encodeURIComponent(params.caseId)}`;
  switch (str(fd, 'intent')) {
    case 'ack': return run(() => api.post(`${base}/acknowledge`), 'Accusé de réception envoyé.');
    case 'evaluate': return run(() => api.post(`${base}/evaluate`, { gravity: str(fd, 'gravity'), measures: str(fd, 'measures'), informDirector: flag(fd, 'informDirector'), informFamily: flag(fd, 'informFamily') }), 'Évaluation enregistrée.');
    case 'addAction': return run(() => api.post(`${base}/actions`, { label: str(fd, 'label'), owner: str(fd, 'owner') }), 'Action ajoutée.');
    case 'toggle': return run(() => api.post(`${base}/actions/${str(fd, 'index')}/toggle`), 'Action mise à jour.');
    case 'prepareClose': return run(() => api.post(`${base}/prepare-close`), 'Dossier prêt pour la clôture.');
    case 'close': return run(() => api.post(`${base}/close`, { summary: str(fd, 'summary'), directorAgreement: flag(fd, 'directorAgreement') }), 'Signalement clos avec l’accord de la directrice.');
  }
  return null;
}

const SUB = ['sous 4 h', 'sous 24 h', 'suivi des mesures', 'avec la directrice'];

export default function Case({ loaderData: { info, state } }: Route.ComponentProps) {
  const f = useFetcher<{ ok: boolean; error?: string }>();
  const [gravity, setGravity] = useState(state.gravity ?? '');
  const [owner, setOwner] = useState('Référente');
  const [informDirector, setInformDirector] = useState(false);
  const [informFamily, setInformFamily] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const post = (intent: string, extra?: Record<string, string>) => f.submit({ intent, ...extra }, { method: 'post' });
  const doneN = state.actions.filter((a) => a.done).length;

  return (
    <>
      <PageHeader kicker="Vie scolaire › Signalement confidentiel" title={`Dossier #${info.id}`} action={<LinkButton variant="secondary" to="/ecole/vie-scolaire" icon="arrow-left">Retour aux signalements</LinkButton>} />
      {f.data && !f.data.ok && <Notice tone="error">{f.data.error}</Notice>}

      <ol className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Avancement du dossier">
        {CASE_STEPS.map((label, i) => {
          const n = i + 1; const done = n < state.step; const cur = n === state.step;
          return (
            <li key={label} aria-current={cur ? 'step' : undefined} className={cx('flex items-center gap-2.5 border-t-2 pt-3', done || cur ? 'border-accent' : 'border-divider')}>
              <span className={cx('grid h-7 w-7 flex-none place-items-center rounded-full border-[1.5px] font-heading font-semibold text-accent-800', done ? 'border-accent bg-accent-100' : cur ? 'border-accent' : 'border-divider text-neutral-600')}>{done ? <Icon name="check" size={14} /> : n}</span>
              <span className="text-[14px] leading-tight"><span className={cur ? 'text-accent-800' : done ? '' : 'text-neutral-600'}>{label}</span><br /><span className="text-[11.5px] text-neutral-600">{SUB[i]}</span></span>
            </li>
          );
        })}
      </ol>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          {state.step === 1 && (
            <Section title="Accuser réception"><p className="mb-3 text-[14px] text-neutral-700">L’auteur du signalement est informé que le dossier est pris en charge. Délai : 4 heures.</p>
              <Button icon="mail-check" onClick={() => post('ack')}>Accuser réception</Button></Section>
          )}
          {state.step === 2 && (
            <Section title="Première évaluation">
              <div className="flex flex-col gap-4">
                <Field label="Gravité">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[['Faible', 'suivi simple'], ['Modérée', 'mesures dans la semaine'], ['Élevée', 'protection immédiate']].map(([g, sub]) => (
                      <button key={g} type="button" aria-pressed={gravity === g} onClick={() => setGravity(g!)} className={cx('rounded-lg border p-3 text-left', gravity === g ? 'border-[1.5px] border-accent bg-accent-100' : 'border-divider hover:bg-neutral-200')}>
                        <div className="font-heading text-[18px] font-semibold">{g}</div><div className="text-[12px] text-neutral-700">{sub}</div>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Mesures envisagées"><Textarea id="measures" rows={3} /></Field>
                <Toggle label="Informer la directrice maintenant" sub="Elle reçoit le dossier complet." checked={informDirector} onChange={setInformDirector} />
                <Toggle label="Prévenir la famille" sub="Selon le protocole, sauf si cela met l’élève en danger." checked={informFamily} onChange={setInformFamily} />
                <Button icon="check" disabled={!gravity} onClick={() => post('evaluate', { gravity, measures: (document.getElementById('measures') as HTMLTextAreaElement).value, informDirector: String(informDirector), informFamily: String(informFamily) })}>Enregistrer l’évaluation</Button>
              </div>
            </Section>
          )}
          {state.step === 3 && (
            <Section title="Plan d’action" note={`${doneN} / ${state.actions.length} faites`}>
              {state.actions.map((a, i) => (
                <label key={`${a.label}-${i}`} className="flex cursor-pointer items-center gap-3 border-t border-divider py-2.5">
                  <input type="checkbox" checked={a.done} onChange={() => post('toggle', { index: String(i) })} className="h-4 w-4 accent-[var(--color-accent)]" />
                  <span className={cx('flex-1 text-[14px]', a.done && 'line-through opacity-60')}>{a.label}<span className="block text-[12px] text-neutral-600">{a.owner} · {a.due}</span></span>
                </label>
              ))}
              {!state.actions.length && <p className="py-2 text-[13.5px] italic text-neutral-600">Aucune action pour l’instant.</p>}
              <div className="mt-3 flex flex-col gap-3 border-t border-divider pt-4">
                <Field label="Nouvelle action"><Input id="newAction" placeholder="Ex. Entretien avec l’élève" /></Field>
                <Chips name="owner" options={['Référente', 'Directrice', 'Prof. principal']} value={owner} onChange={setOwner} />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="secondary" icon="plus" onClick={() => { const el = document.getElementById('newAction') as HTMLInputElement; if (el.value.trim()) { post('addAction', { label: el.value, owner }); el.value = ''; } }}>Ajouter</Button>
                  <Button disabled={!state.actions.length} onClick={() => post('prepareClose')}>Passer à la clôture</Button>
                </div>
              </div>
            </Section>
          )}
          {state.step === 4 && (
            <Section title="Clôture avec la directrice">
              <div className="flex flex-col gap-4">
                <Field label="Synthèse de la situation"><Textarea id="summary" rows={4} /></Field>
                <Toggle label="La directrice a donné son accord" checked={agreed} onChange={setAgreed} />
                <Button icon="lock-keyhole" disabled={!agreed} onClick={() => post('close', { summary: (document.getElementById('summary') as HTMLTextAreaElement).value, directorAgreement: String(agreed) })}>Clore le signalement</Button>
              </div>
            </Section>
          )}
          {state.step === 5 && <Notice>Signalement clos avec l’accord de la directrice.</Notice>}
        </div>

        <div className="flex flex-col gap-5">
          <Section title="Le dossier">
            <dl className="text-[14px]">
              {[['Type', info.type], ['Ouvert par', info.reporter], ['Classe', info.className], ['Élève concerné', info.student], ['Reçu', info.received]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-t border-divider py-2"><dt className="text-neutral-700">{k}</dt><dd className="text-right">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-3 border-l-2 border-accent pl-3 text-[14px] italic leading-relaxed">« {info.text} »</p>
          </Section>
          <Section title="Journal">
            <ol className="flex flex-col gap-2 text-[13px]">
              <li className="flex gap-3"><span className="tnum w-12 flex-none text-neutral-600">{info.received.split(', ')[1] ?? info.received}</span>Signalement reçu</li>
              {state.log.map((l, i) => <li key={i} className="flex gap-3"><span className="tnum w-12 flex-none text-neutral-600">{l.at}</span>{l.event}</li>)}
            </ol>
          </Section>
        </div>
      </div>
    </>
  );
}
