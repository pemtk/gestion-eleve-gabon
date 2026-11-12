import { useState } from 'react';
import { Form } from 'react-router';
import { PageHeader } from '~/components/blocks';
import { ActionNotice, Button, Field, Input, Section, Select, Textarea, Toggle } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { flag, str } from '~/lib/form';
import type { Route } from './+types/reports';

type Report = { id: string; school: string; date: string; text: string };

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'agent');
  const [reports, schools] = await Promise.all([api.get<Report[]>('/agent/reports'), api.get<{ name: string }[]>('/agent/schools')]);
  return { reports, schools: schools.map((s) => s.name) };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'agent');
  const fd = await request.formData();
  return run(() => api.post('/agent/reports', { schoolId: str(fd, 'school'), date: str(fd, 'date'), observations: str(fd, 'observations'), attachment: flag(fd, 'attachment') ? 'photo.jpg' : undefined, visibleToSchool: flag(fd, 'visible') }), 'Compte-rendu enregistré. Il est visible par l’administrateur plateforme.');
}

export default function Reports({ loaderData: d, actionData }: Route.ComponentProps) {
  const [visible, setVisible] = useState(false);
  const [attach, setAttach] = useState(false);
  return (
    <>
      <PageHeader kicker="Lycée Léon Mba · visite du 10 novembre" title="Nouveau compte-rendu" />
      <ActionNotice result={actionData ?? undefined} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Section title="Observations de la visite">
          <Form method="post" className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="École"><Select name="school">{d.schools.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Date de la visite"><Input name="date" type="date" defaultValue="2026-11-10" required /></Field>
            </div>
            <Field label="Observations"><Textarea name="observations" rows={7} required placeholder="Ce que vous avez constaté, les décisions prises, les points à suivre." /></Field>
            <Toggle name="attachment" label="Joindre une photo ou un document" checked={attach} onChange={setAttach} />
            <Toggle name="visible" label="Visible par l’école" sub="L’administrateur plateforme le voit toujours" checked={visible} onChange={setVisible} />
            <div className="flex justify-end"><Button type="submit" icon="save">Enregistrer</Button></div>
          </Form>
        </Section>
        <Section title="Comptes-rendus précédents">
          {d.reports.map((r) => (
            <div key={r.id} className="border-t border-divider py-3 text-[13.5px]"><div className="font-semibold">{r.school} · {r.date}</div><div className="text-neutral-700">{r.text}</div></div>
          ))}
        </Section>
      </div>
    </>
  );
}
