import { useState } from 'react';
import { Form } from 'react-router';
import { AGENT_SCOPES, PARTNER_SCOPES } from '@sge/shared';
import { Cell, DataGrid, PageHeader } from '~/components/blocks';
import { ActionNotice, Button, Chips, Field, Input, Section } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import type { Route } from './+types/users';

type U = { name: string; role: string; scope: string; status: string };

export async function loader({ request }: Route.LoaderArgs) {
  return { users: await (await spaceApi(request, 'admin')).get<U[]>('/admin/users') };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'admin');
  const fd = await request.formData();
  const role = str(fd, 'role') === 'Agent' ? 'agent' : 'partenaire';
  return run(() => api.post('/admin/users/invite', { name: str(fd, 'name'), phone: str(fd, 'phone'), role, scopes: fd.getAll('scope').map(String) }), 'Invitation envoyée par email et SMS.');
}

export default function AdminUsers({ loaderData: d, actionData }: Route.ComponentProps) {
  const [role, setRole] = useState('Agent');
  const [scopes, setScopes] = useState<string[]>([]);
  const options = role === 'Agent' ? AGENT_SCOPES : PARTNER_SCOPES;
  const toggle = (s: string) => setScopes((x) => (x.includes(s) ? x.filter((v) => v !== s) : [...x, s]));
  return (
    <>
      <PageHeader kicker="Utilisateurs institutionnels" title="Agents et partenaires" />
      <ActionNotice result={actionData ?? undefined} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Section title="Inviter">
          <Form method="post" className="flex flex-col gap-3.5">
            <input type="hidden" name="role" value={role} />
            <Field label="Profil"><Chips name="role-ui" options={['Agent', 'Partenaire']} value={role} onChange={(r) => { setRole(r); setScopes([]); }} /></Field>
            <Field label="Nom"><Input name="name" required /></Field>
            <Field label="Téléphone"><Input name="phone" inputMode="tel" placeholder="+241 07 …" required /></Field>
            <Field label={role === 'Agent' ? 'Écoles assignées' : 'Régions autorisées (données agrégées)'}>
              <Chips name="scope-ui" multiple options={options} value={scopes} onChange={toggle} />
            </Field>
            {scopes.map((s) => <input key={s} type="hidden" name="scope" value={s} />)}
            <Button type="submit" icon="send" disabled={!scopes.length}>Inviter</Button>
          </Form>
        </Section>
        <DataGrid title="Utilisateurs" note={`${d.users.length} comptes`} columns="1.8fr .9fr 1.5fr 1fr" head={['Nom', 'Profil', 'Périmètre', 'Statut']}
          rows={d.users.map((u) => [u.name, u.role, u.scope, <Cell key="s">{u.status}</Cell>])} />
      </div>
    </>
  );
}
