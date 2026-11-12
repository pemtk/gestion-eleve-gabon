import { useState } from 'react';
import { Form, Link } from 'react-router';
import { Icon } from '~/components/icon';
import { PageHeader } from '~/components/blocks';
import { ActionNotice, Button, Field, Input, Notice, Section, Tag, Toggle } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { flag, str } from '~/lib/form';
import type { Route } from './+types/referent';

type Data = { referent: { name: string; confirmed: boolean } | null; confidentialEnabled: boolean; delays: { acknowledgeHours: number; evaluationHours: number }; cases: { id: string; type: string; className: string; received: string; step: number; student: string }[]; conduct: { id: string; type: string; className: string; received: string; student: string; reporter: string; text: string }[] };

export async function loader({ request }: Route.LoaderArgs) {
  return (await spaceApi(request, 'ecole')).get<Data>('/school/referent');
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  return run(() => api.put('/school/referent', { name: str(fd, 'name'), confirmed: flag(fd, 'confirmed') }), 'Référent enregistré.');
}

const STEP_LABEL = ['', 'À accuser réception', 'À évaluer', 'Plan d’action', 'À clore', 'Clos'];

export default function Referent({ loaderData: d, actionData }: Route.ComponentProps) {
  const [confirmed, setConfirmed] = useState(d.referent?.confirmed ?? false);
  return (
    <>
      <PageHeader kicker="Vie scolaire" title="Référents et signalements" />
      <ActionNotice result={actionData ?? undefined} />
      {!d.confidentialEnabled && <Notice tone="info">Sans référent désigné, seuls les signalements « Conduite / engagement » peuvent être utilisés.</Notice>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-5">
          <Section title="Référent vie scolaire">
            <Form method="post" className="flex flex-col gap-3">
              <Field label="Membre de l’administration (SCHOOL_ADMIN)"><Input name="name" defaultValue={d.referent?.name} required /></Field>
              <Toggle name="confirmed" label="A lu le protocole de signalement" sub="Le référent doit le confirmer avant de traiter des dossiers" checked={confirmed} onChange={setConfirmed} />
              <Button type="submit" icon="check">Enregistrer</Button>
            </Form>
          </Section>
          <Section title="Délais de traitement">
            <ul className="flex flex-col gap-2 text-[14px]">
              <li className="flex items-center gap-2.5"><Icon name="clock" size={16} className="text-accent-700" />Accusé de réception sous <strong className="tnum">{d.delays.acknowledgeHours} h</strong></li>
              <li className="flex items-center gap-2.5"><Icon name="clipboard-check" size={16} className="text-accent-700" />Première évaluation sous <strong className="tnum">{d.delays.evaluationHours} h</strong></li>
              <li className="flex items-center gap-2.5"><Icon name="list-checks" size={16} className="text-accent-700" />Plan d’action tenu à jour, puis clôture avec le directeur</li>
            </ul>
          </Section>
        </div>
        <Section title="Signalements confidentiels" note="visibles uniquement du référent et du directeur">
          {d.cases.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 border-t border-divider py-3">
              <div className="min-w-0 flex-1 text-[14px]"><div className="font-semibold">#{c.id} · {c.type}</div><div className="text-[12.5px] text-neutral-700">{c.className} · reçu {c.received}</div></div>
              <Tag tone={c.step >= 5 ? 'hi' : c.step === 1 ? 'warn' : 'n'}>{STEP_LABEL[c.step]}</Tag>
              <Link to={`/ecole/vie-scolaire/${c.id}`} className="text-[13px] font-semibold">Ouvrir le dossier</Link>
            </div>
          ))}
        </Section>
      </div>
      <Section title="Conduite et engagement" note="signalés par les enseignants, visibles de l’école">
        {d.conduct.map((c) => (
          <div key={c.id} className="border-t border-divider py-3 text-[14px]">
            <div className="font-semibold">#{c.id} · {c.student} <span className="font-normal text-neutral-700">· {c.className}</span></div>
            <div className="text-neutral-800">{c.text}</div>
            <div className="text-[12.5px] text-neutral-600">{c.reporter} · {c.received}</div>
          </div>
        ))}
        {!d.conduct.length && <p className="text-[13.5px] italic text-neutral-600">Aucun signalement de conduite.</p>}
      </Section>
    </>
  );
}
