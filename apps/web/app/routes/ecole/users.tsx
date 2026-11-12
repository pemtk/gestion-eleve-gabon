import { useState } from 'react';
import { Form, Link, useFetcher, useNavigation } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { type Student } from '@sge/shared';
import { Icon } from '~/components/icon';
import { PageHeader } from '~/components/blocks';
import { ActionNotice, Avatar, Button, Field, Input, LinkButton, Notice, Section, Select, Tabs, Tag, cx, toneOf } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import type { ClassRow, LinkRequestRow, StudentRow, SubscriptionInfo, TeacherRow } from '~/lib/types';
import { useSchoolName } from '~/lib/school';
import type { Route } from './+types/users';

const TABS = ['eleves', 'profs', 'ratt'] as const;

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  const url = new URL(request.url);
  const t = url.searchParams.get('tab');
  const tab = TABS.find((x) => x === t) ?? 'eleves';
  const [students, teachers, requests, classes, sub] = await Promise.all([
    api.get<StudentRow[]>('/school/students'),
    api.get<TeacherRow[]>('/school/teachers'),
    api.get<LinkRequestRow[]>('/school/link-requests'),
    api.get<ClassRow[]>('/school/classes'),
    api.get<SubscriptionInfo>('/school/subscription'),
  ]);
  const selected = students.find((s) => s.id === url.searchParams.get('eleve')) ?? students[0];
  return { tab, students, teachers, requests, classes, sms: sub.features.sms, selected, pending: requests.filter((r) => !r.decision).length };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  switch (str(fd, 'intent')) {
    case 'student':
      return run(
        () => api.post<{ smsSent: boolean }>('/school/students', { lastName: str(fd, 'lastName'), firstName: str(fd, 'firstName'), phone: str(fd, 'phone'), classId: str(fd, 'classId') }),
        (r) => (r.smsSent ? 'Élève créé. SMS d’activation envoyé ; code parent généré.' : 'Élève créé. Codes d’activation et parent à imprimer (relais SMS : formule Standard).'),
      );
    case 'regenerate':
      return run(() => api.post(`/school/students/${str(fd, 'id')}/regenerate-code`), 'Nouveau code généré. L’ancien est désactivé.');
    case 'sendCode':
      return run(() => api.post(`/school/students/${str(fd, 'id')}/send-code`), 'Code envoyé par SMS au numéro parent enregistré.');
    case 'invite':
      return run(() => api.post('/school/teachers/invite', { name: str(fd, 'name'), phone: str(fd, 'phone') }), 'Invitation envoyée par SMS. Affectez l’enseignant dès qu’il a activé son compte.');
    case 'resend':
      return run(() => api.post(`/school/teachers/${str(fd, 'id')}/resend`), 'Invitation renvoyée.');
    case 'accept':
    case 'refuse':
      return run(() => api.post(`/school/link-requests/${str(fd, 'id')}/${str(fd, 'intent')}`), str(fd, 'intent') === 'accept' ? 'Rattachement validé. Le parent est prévenu.' : 'Demande refusée.');
  }
  return null;
}

export default function Users({ loaderData: d, actionData }: Route.ComponentProps) {
  const school = useSchoolName();
  const link = (tab: string) => `/ecole/utilisateurs?tab=${tab}`;
  return (
    <>
      <PageHeader kicker={`Utilisateurs · ${school}`} title="Élèves, enseignants et parents"
        action={<LinkButton to="/ecole/utilisateurs/import" icon="upload">Importer des élèves</LinkButton>} />
      <Tabs items={[
        { to: link('eleves'), label: 'Élèves', badge: String(d.students.length), active: d.tab === 'eleves' },
        { to: link('profs'), label: 'Enseignants', badge: String(d.teachers.length), active: d.tab === 'profs' },
        { to: link('ratt'), label: 'Rattachements à valider', badge: String(d.pending), active: d.tab === 'ratt' },
      ]} />
      <ActionNotice result={actionData ?? undefined} />
      {d.tab === 'eleves' && <Students d={d} />}
      {d.tab === 'profs' && <Teachers d={d} />}
      {d.tab === 'ratt' && <Requests d={d} />}
    </>
  );
}

type D = Route.ComponentProps['loaderData'];

function Students({ d }: { d: D }) {
  const [creating, setCreating] = useState(false);
  const nav = useNavigation();
  return (
    <>
      {!creating ? (
        <div className="flex flex-wrap gap-2">
          <Button icon="user-plus" onClick={() => setCreating(true)}>Nouvel élève</Button>
          <LinkButton variant="secondary" to="/ecole/utilisateurs/import" icon="upload">Importer un fichier CSV</LinkButton>
        </div>
      ) : (
        <Section title="Nouvel élève" note="Un SMS d’activation lui sera envoyé.">
          <Form method="post" onSubmit={() => setTimeout(() => setCreating(false), 0)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="intent" value="student" />
            <Field label="Nom"><Input name="lastName" placeholder="Ex. Mboumba" required /></Field>
            <Field label="Prénom"><Input name="firstName" placeholder="Ex. Ruth" required /></Field>
            <Field label="Téléphone"><Input name="phone" inputMode="tel" placeholder="+241 07 …" required /></Field>
            <Field label="Classe"><Select name="classId" required>{d.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button variant="secondary" onClick={() => setCreating(false)}>Annuler</Button>
              <Button type="submit" disabled={nav.state !== 'idle'}>Créer et envoyer le SMS</Button>
            </div>
          </Form>
        </Section>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Section className="overflow-hidden !p-0">
          <div className="grid grid-cols-[1.6fr_1fr_1fr_.8fr] border-b border-divider px-2 text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            {['Élève', 'Classe', 'Compte', 'Parents'].map((h) => <div key={h} className="px-2 py-2.5">{h}</div>)}
          </div>
          {d.students.map((s) => {
            const on = s.id === d.selected?.id;
            const acct = s.smsSent && !s.activated ? 'SMS envoyé' : s.activated ? 'Activé' : 'SMS non reçu';
            return (
              <Link key={s.id} to={`/ecole/utilisateurs?tab=eleves&eleve=${s.id}`} preventScrollReset aria-current={on || undefined}
                className={cx('grid grid-cols-[1.6fr_1fr_1fr_.8fr] items-center border-b border-divider px-2 py-2.5 text-[13.5px] text-text no-underline hover:bg-neutral-100 hover:text-text', on && 'bg-accent-100 shadow-[inset_2px_0_0_var(--color-accent)]')}>
                <div className="px-2">{s.firstName} {s.lastName}</div>
                <div className="px-2">{s.className}</div>
                <div className="px-2"><Tag tone={toneOf(acct)}>{acct}</Tag></div>
                <div className={cx('tnum px-2', !s.parents.length && 'text-accent-800')}>{s.parents.length ? `${s.parents.length} / 2` : 'aucun'}</div>
              </Link>
            );
          })}
        </Section>
        {d.selected && <StudentPanel s={d.selected} sms={d.sms} />}
      </div>
    </>
  );
}

function StudentPanel({ s, sms }: { s: StudentRow; sms: boolean }) {
  const f = useFetcher<{ ok: boolean; message?: string; error?: string }>();
  const act = (intent: string, label: string, icon: string, locked = false) => (
    <f.Form method="post" action="/ecole/utilisateurs?tab=eleves" className="flex-1">
      <input type="hidden" name="intent" value={intent} /><input type="hidden" name="id" value={s.id} />
      <Button type="submit" variant="secondary" icon={locked ? 'lock' : icon} disabled={locked} className="w-full !text-[14px]">{label}</Button>
    </f.Form>
  );
  return (
    <Section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar initials={s.initials} size={44} />
        <div><div className="font-heading text-[22px] leading-tight font-semibold">{s.firstName} {s.lastName}</div>
          <div className="text-[12.5px] text-neutral-700">{s.className} · {s.phone ? `+241 ${s.phone}` : 'pas de téléphone'}</div></div>
      </div>
      <div className="flex items-center gap-4 rounded-lg border border-accent-300 bg-accent-100 p-3.5">
        <div className="rounded-md bg-white p-2" aria-label={`QR code du code ${s.codeLabel}`}><QRCodeSVG value={`sge://rattachement?code=${s.code}`} size={84} /></div>
        <div>
          <div className="text-[11px] tracking-[.1em] text-accent-700 uppercase">Code d’invitation parent</div>
          <div className="tnum font-heading text-[34px] leading-none text-accent-800">{s.codeLabel}</div>
          <div className="mt-1 text-[11.5px] text-accent-800">Valable jusqu’au 31/12/2026 · 2 parents au maximum</div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" icon="printer" className="flex-1 !text-[14px]" onClick={() => window.print()}>Imprimer la fiche</Button>
        {act('sendCode', 'Envoyer par SMS', 'message-square', !sms)}
      </div>
      <div>
        <div className="mb-1 text-[11px] tracking-[.1em] text-accent-700 uppercase">Parents rattachés</div>
        {s.parents.map((p) => <div key={p.name} className="flex justify-between border-t border-divider py-2 text-[14px]"><span>{p.name}</span><span className="text-neutral-700">{p.relation}</span></div>)}
        {!s.parents.length && <div className="border-t border-divider py-2 text-[13.5px] italic text-accent-800">Aucun parent rattaché : remettez la fiche.</div>}
      </div>
      {act('regenerate', 'Régénérer le code (l’ancien ne fonctionnera plus)', 'refresh-cw')}
      {f.data && !f.data.ok && <Notice tone="error">{f.data.error}</Notice>}
      {f.data?.ok && <Notice>{f.data.message}</Notice>}
    </Section>
  );
}

function Teachers({ d }: { d: D }) {
  return (
    <>
      <Section>
        <Form method="post" className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="intent" value="invite" />
          <Field label="Prénom et nom"><Input name="name" placeholder="Ex. Rachel Nziengui" required /></Field>
          <Field label="Téléphone"><Input name="phone" inputMode="tel" placeholder="+241 07 …" required /></Field>
          <Button type="submit" icon="send" disabled={!d.sms}>Inviter par SMS</Button>
        </Form>
        {!d.sms && <div className="mt-3 flex items-center gap-2 text-[13px] text-accent-800"><Icon name="lock" size={14} />Invitations par SMS incluses à partir de la formule Standard.</div>}
      </Section>
      <Section className="overflow-x-auto !p-0">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[1.2fr_1fr_1.8fr_1fr_.7fr] border-b border-divider px-2 text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            {['Enseignant', 'Téléphone', 'Affectations', 'Statut', ''].map((h, i) => <div key={i} className="px-2 py-2.5">{h}</div>)}
          </div>
          {d.teachers.map((t) => (
            <div key={t.id} className="grid grid-cols-[1.2fr_1fr_1.8fr_1fr_.7fr] items-center border-b border-divider px-2 py-2.5 text-[13.5px]">
              <div className="px-2">{t.name}</div><div className="tnum px-2">{t.phone}</div>
              <div className={cx('px-2', t.assignments ? 'text-neutral-700' : 'italic text-accent-800')}>{t.assignments || 'aucune affectation'}</div>
              <div className="px-2"><Tag tone={toneOf(t.status)}>{t.status}</Tag></div>
              <div className="px-2">{t.status !== 'Activé' && <ResendButton id={t.id} />}</div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function ResendButton({ id }: { id: string }) {
  const f = useFetcher();
  return (
    <f.Form method="post" action="/ecole/utilisateurs?tab=profs">
      <input type="hidden" name="intent" value="resend" /><input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost">Relancer</Button>
    </f.Form>
  );
}

function Requests({ d }: { d: D }) {
  return (
    <>
      <Notice tone="info">Un code valide rattache le parent tout de suite. Les demandes ci-dessous attendent votre validation : code expiré, code déjà utilisé deux fois, ou numéro de parent inconnu de l’école.</Notice>
      <Section className="!p-0">
        {d.requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-divider px-5 py-3.5 last:border-b-0">
            <Avatar initials={r.parent.split(' ').map((p) => p[0]).join('')} size={38} />
            <div className="min-w-0 flex-1 text-[14px]">
              <div><span className="font-semibold">{r.parent}</span> · {r.relation} de <span className="font-semibold">{r.child}</span></div>
              <div className="text-[12.5px] text-neutral-700">{r.meta}</div>
            </div>
            {r.decision ? (
              <Tag tone={r.decision === 'ok' ? 'hi' : 'n'}>{r.decision === 'ok' ? 'Validé · parent prévenu' : 'Refusé'}</Tag>
            ) : (
              <RequestActions id={r.id} />
            )}
          </div>
        ))}
      </Section>
    </>
  );
}

function RequestActions({ id }: { id: string }) {
  const f = useFetcher();
  return (
    <f.Form method="post" action="/ecole/utilisateurs?tab=ratt" className="flex gap-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" name="intent" value="refuse" variant="secondary">Refuser</Button>
      <Button type="submit" name="intent" value="accept">Valider</Button>
    </f.Form>
  );
}

export type { Student };
