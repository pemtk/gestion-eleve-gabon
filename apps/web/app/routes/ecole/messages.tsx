import { useEffect, useRef } from 'react';
import { Form, Link, redirect, useRevalidator } from 'react-router';
import { randomUUID } from 'node:crypto';
import type { Contact, Message, ThreadSummary } from '@sge/shared';
import { Icon } from '~/components/icon';
import { PageHeader } from '~/components/blocks';
import { Button, FilePicker, Notice, Section, Select, Textarea, cx } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import type { Route } from './+types/messages';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  const id = new URL(request.url).searchParams.get('t');
  const [threads, contacts] = await Promise.all([api.get<ThreadSummary[]>('/threads'), api.get<Contact[]>('/threads/contacts')]);
  const selected = id ? threads.find((t) => t.id === id) ?? null : null;
  const messages = selected ? await api.get<Message[]>(`/threads/${selected.id}/messages`) : [];
  // Ouvrir une conversation la marque comme lue (les non-lus de la liste sont ceux d'avant l'ouverture).
  if (selected) await api.post(`/threads/${selected.id}/read`, {});
  return { threads, contacts, selected, messages };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  if (str(fd, 'intent') === 'start') {
    const t = await api.post<ThreadSummary>('/threads', { contact: str(fd, 'contact') });
    throw redirect(`/ecole/messages?t=${t.id}`);
  }
  const thread = str(fd, 'thread');
  return run(async () => {
    const fileId = await api.uploadIfAny(fd, 'file', 'message');
    return api.post(`/threads/${thread}/messages`, { text: str(fd, 'text') || undefined, fileId, clientId: `w-${randomUUID()}` });
  }, 'Message envoyé.');
}

export default function Messages({ loaderData: d, actionData }: Route.ComponentProps) {
  const { revalidate, state } = useRevalidator();
  const form = useRef<HTMLFormElement>(null);
  // Actualisation par interrogation toutes les 10 s, onglet visible seulement.
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && state === 'idle') revalidate(); }, 10_000);
    return () => clearInterval(timer);
  }, [revalidate, state]);
  useEffect(() => { if (actionData?.ok) form.current?.reset(); }, [actionData]);
  return (
    <>
      <PageHeader kicker="Communication" title="Messages" />
      {actionData && !actionData.ok && <Notice tone="error">{actionData.error}</Notice>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="flex flex-col gap-5">
          <Section title="Nouvelle conversation">
            <Form method="post" className="flex gap-2">
              <input type="hidden" name="intent" value="start" />
              <Select name="contact" required aria-label="Destinataire" className="flex-1">
                <option value="">Choisir une personne…</option>
                {d.contacts.map((c) => <option key={c.key} value={c.key}>{c.name} — {c.label}</option>)}
              </Select>
              <Button type="submit" icon="plus">Écrire</Button>
            </Form>
          </Section>
          <Section title="Conversations">
            {d.threads.map((t) => (
              <Link key={t.id} to={`/ecole/messages?t=${t.id}`} className={cx('flex items-center gap-3 border-t border-divider py-2.5 no-underline text-text hover:bg-neutral-200', d.selected?.id === t.id && 'bg-accent-100')}>
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-accent-400 text-[13px] font-semibold text-accent-800">{t.initials || <Icon name={t.icon ?? 'users'} size={18} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2"><span className={cx('truncate', t.unread > 0 && 'font-semibold')}>{t.name}</span><span className="flex-none text-[12px] text-neutral-600">{t.time}</span></span>
                  <span className="block text-[12px] text-neutral-600">{t.kind}</span>
                  <span className={cx('block truncate text-[13.5px]', t.unread > 0 ? 'text-text' : 'text-neutral-700')}>{t.last}</span>
                </span>
                {t.unread > 0 && <span aria-label={`${t.unread} non lu${t.unread > 1 ? 's' : ''}`} className="inline-flex h-5.5 min-w-5.5 flex-none items-center justify-center rounded-full bg-accent-200 px-1.5 text-[12px] font-semibold text-accent-800">{t.unread}</span>}
              </Link>
            ))}
            {!d.threads.length && <p className="text-[13.5px] italic text-neutral-600">Aucune conversation pour l’instant.</p>}
          </Section>
        </div>
        <Section title={d.selected ? `${d.selected.name} · ${d.selected.kind}` : 'Conversation'}>
          {!d.selected && <p className="text-[14px] text-neutral-700">Choisissez une conversation, ou écrivez à un parent ou à un enseignant.</p>}
          {d.selected && (
            <div className="flex flex-col gap-3">
              <div aria-live="polite" className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
                {d.messages.map((m) => (
                  <div key={m.id} className={cx('max-w-[82%] rounded-lg border px-3 py-2 text-[14px]', m.mine ? 'self-end border-accent-300 bg-accent-100' : 'self-start border-divider bg-neutral-100')}>
                    {!m.mine && d.selected?.group && m.sender && <div className="text-[12px] font-semibold text-accent-800">{m.sender}</div>}
                    {m.fileId && <a href={`/fichiers/${m.fileId}`} target="_blank" rel="noreferrer"><img src={`/fichiers/${m.fileId}`} alt="Image envoyée" className="mb-1 max-h-48 rounded-md" /></a>}
                    {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                    <div className="text-right text-[11px] text-neutral-600">{m.time}</div>
                  </div>
                ))}
                {!d.messages.length && <p className="text-[13.5px] italic text-neutral-600">Aucun message.</p>}
              </div>
              {d.selected.canPost !== false ? (
                <Form ref={form} method="post" encType="multipart/form-data" className="flex flex-col gap-3 border-t border-divider pt-3">
                  <input type="hidden" name="thread" value={d.selected.id} />
                  <Textarea name="text" rows={3} maxLength={2000} placeholder="Écrire un message…" aria-label="Message" />
                  <FilePicker name="file" kind="message" label="Joindre une image" />
                  <div className="flex justify-end"><Button type="submit" icon="send">Envoyer</Button></div>
                </Form>
              ) : (
                <p className="flex items-center gap-2 border-t border-divider pt-3 text-[13px] text-neutral-700"><Icon name="lock" size={14} />Vous ne pouvez pas écrire dans cette conversation.</p>
              )}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
