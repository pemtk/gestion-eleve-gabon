import { useState } from 'react';
import { Form } from 'react-router';
import type { Organization } from '@sge/shared';
import { Cell, DataGrid, PageHeader } from '~/components/blocks';
import { ActionNotice, Button, Chips, Field, Input, Section, Select } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import type { Route } from './+types/organizations';

export async function loader({ request }: Route.LoaderArgs) {
  return { orgs: await (await spaceApi(request, 'admin')).get<Organization[]>('/admin/organizations') };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'admin');
  const fd = await request.formData();
  return run(() => api.post('/admin/organizations', { type: str(fd, 'type'), name: str(fd, 'name'), address: str(fd, 'address'), phone: str(fd, 'phone'), email: str(fd, 'email'), parentId: str(fd, 'parentId') || undefined }), 'Organisation créée avec 30 jours d’essai.');
}

export default function Organizations({ loaderData: d, actionData }: Route.ComponentProps) {
  const [type, setType] = useState('École');
  const parents = d.orgs.filter((o) => o.type !== 'École');
  return (
    <>
      <PageHeader kicker="Organisations" title="Créer une organisation" />
      <ActionNotice result={actionData ?? undefined} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Section title="Nouvelle organisation">
          <Form method="post" className="flex flex-col gap-3.5">
            <input type="hidden" name="type" value={type} />
            <Field label="Type"><Chips name="type-ui" options={['École', 'Diocèse', 'Réseau']} value={type} onChange={setType} /></Field>
            <Field label="Nom"><Input name="name" required /></Field>
            <Field label="Adresse"><Input name="address" /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Téléphone"><Input name="phone" inputMode="tel" /></Field><Field label="Email"><Input name="email" type="email" /></Field></div>
            {type === 'École' && <Field label="Rattachée à" hint="Facultatif : un diocèse ou un réseau existant"><Select name="parentId"><option value="">Aucune</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>}
            <Button type="submit" icon="plus">Enregistrer</Button>
          </Form>
        </Section>
        <DataGrid title="Arborescence" note={`${d.orgs.length} organisations`} columns="1.8fr .8fr 1fr 1fr" head={['Organisation', 'Type', 'Formule', 'Statut']}
          rows={d.orgs.map((o) => [<span key="n" style={{ paddingLeft: o.parentId ? 14 : 0 }}>{o.parentId && '↳ '}{o.name}</span>, o.type, o.plan, <Cell key="s">{o.status}</Cell>])} />
      </div>
    </>
  );
}
