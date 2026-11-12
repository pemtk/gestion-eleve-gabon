import { useState } from 'react';
import { useFetcher } from 'react-router';
import { ANNOUNCE_TEMPLATES } from '@sge/shared';
import { Icon } from '~/components/icon';
import { PageHeader } from '~/components/blocks';
import { Button, Chips, Field, Input, Notice, Section, Select, Textarea, Toggle } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { flag, str } from '~/lib/form';
import type { ClassRow } from '~/lib/types';
import type { Route } from './+types/announcements';

type Sent = { id: string; title: string; message: string; audience: string; target?: string; at: string };
const AUDIENCES: Record<string, 'school' | 'level' | 'class' | 'teachers' | 'parents'> = {
  'Toute l’école': 'school', 'Un niveau': 'level', 'Une classe': 'class', 'Les enseignants': 'teachers', 'Les parents': 'parents',
};

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  const [sent, classes] = await Promise.all([api.get<Sent[]>('/school/announcements'), api.get<ClassRow[]>('/school/classes')]);
  return { sent, classes };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  return run(() => api.post('/school/announcements', {
    title: str(fd, 'title') || undefined, message: str(fd, 'message'), audience: AUDIENCES[str(fd, 'audience')] ?? 'school',
    target: str(fd, 'target') || undefined, attachment: flag(fd, 'attachment') ? 'document.pdf' : undefined,
  }), 'Annonce envoyée. Les destinataires sont notifiés.');
}

export default function Announcements({ loaderData: d }: Route.ComponentProps) {
  const f = useFetcher<{ ok: boolean; error?: string; message?: string }>();
  const [audience, setAudience] = useState('Toute l’école');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [attach, setAttach] = useState(false);
  const needsTarget = audience === 'Un niveau' || audience === 'Une classe';
  return (
    <>
      <PageHeader kicker="Communication" title="Annonces" />
      {f.data?.ok && <Notice>{f.data.message}</Notice>}
      {f.data && !f.data.ok && <Notice tone="error">{f.data.error}</Notice>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Section title="Nouvelle annonce">
          <f.Form method="post" onSubmit={() => { setMessage(''); setTitle(''); }} className="flex flex-col gap-4">
            <input type="hidden" name="audience" value={audience} />
            <Field label="Destinataires"><Chips name="aud" options={Object.keys(AUDIENCES)} value={audience} onChange={setAudience} /></Field>
            {needsTarget && (
              <Field label={audience === 'Une classe' ? 'Classe' : 'Niveau'}>
                <Select name="target" required>{(audience === 'Une classe' ? d.classes.map((c) => c.name) : ['Primaire', 'Collège', 'Lycée']).map((o) => <option key={o}>{o}</option>)}</Select>
              </Field>
            )}
            <Field label="Modèle"><Chips name="tpl" options={Object.keys(ANNOUNCE_TEMPLATES)} value="" onChange={(k) => setMessage(ANNOUNCE_TEMPLATES[k] ?? '')} /></Field>
            <Field label="Titre"><Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Évaluation de mathématiques" /></Field>
            <Field label="Message"><Textarea name="message" rows={5} required value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
            <Toggle name="attachment" label="Joindre un document" sub="PDF, 5 Mo maximum" checked={attach} onChange={setAttach} />
            <Button type="submit" icon="send" disabled={f.state !== 'idle'}>Envoyer</Button>
          </f.Form>
        </Section>
        <div className="flex flex-col gap-5">
          <Section title="Aperçu">
            <div className="rounded-lg border border-divider p-4">
              <div className="flex items-center gap-2 text-[12px] text-neutral-600"><Icon name="megaphone" size={14} className="text-accent-700" />École · {audience.toLowerCase()}</div>
              <div className="mt-1 font-heading text-[22px] leading-tight font-semibold">{title || 'Sans titre'}</div>
              <p className="mt-1 text-[14px] leading-relaxed text-neutral-800">{message || 'Votre message apparaîtra ici.'}</p>
              {attach && <div className="mt-2 flex items-center gap-2 text-[13px] text-accent-800"><Icon name="paperclip" size={14} />document.pdf</div>}
            </div>
          </Section>
          <Section title="Envoyées">
            {d.sent.map((s) => (
              <div key={s.id} className="border-t border-divider py-2.5 text-[13.5px]"><div className="font-semibold">{s.title || 'Sans titre'}</div><div className="line-clamp-2 text-neutral-700">{s.message}</div></div>
            ))}
            {!d.sent.length && <p className="text-[13.5px] italic text-neutral-600">Aucune annonce envoyée pour l’instant.</p>}
          </Section>
        </div>
      </div>
    </>
  );
}
