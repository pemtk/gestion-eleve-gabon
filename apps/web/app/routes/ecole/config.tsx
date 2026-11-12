import { useState } from 'react';
import { Form } from 'react-router';
import { SCHOOL_YEAR } from '@sge/shared';
import { PageHeader } from '~/components/blocks';
import { ActionNotice, Button, Chips, Field, Input, Section, Select, Tabs, Tag, Toggle } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { flag, str } from '~/lib/form';
import type { ClassRow, TeacherRow } from '~/lib/types';
import type { Route } from './+types/config';

type Year = typeof SCHOOL_YEAR;
type Assignment = { id: string; teacher: string; className: string; subject: string; year: string; principal: boolean };
const TABS = ['annees', 'classes', 'affect'] as const;

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  const t = new URL(request.url).searchParams.get('tab');
  const [year, classes, assignments, teachers] = await Promise.all([
    api.get<Year>('/school/year'), api.get<ClassRow[]>('/school/classes'), api.get<Assignment[]>('/school/assignments'), api.get<TeacherRow[]>('/school/teachers'),
  ]);
  return { tab: TABS.find((x) => x === t) ?? 'annees', year, classes, assignments, teachers };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  switch (str(fd, 'intent')) {
    case 'saveYear':
    case 'activateYear': {
      const terms = [0, 1, 2].map((i) => ({ name: str(fd, `t${i}-name`), start: str(fd, `t${i}-start`), end: str(fd, `t${i}-end`), coefficient: Number(str(fd, `t${i}-coef`).replace(',', '.')) || 1 }));
      const body = { label: str(fd, 'label'), start: str(fd, 'start'), end: str(fd, 'end'), terms };
      const activate = str(fd, 'intent') === 'activateYear';
      return run(async () => { await api.put('/school/year', body); if (activate) await api.post('/school/year/activate'); }, activate ? 'Année scolaire activée : elle est maintenant visible de tous.' : 'Année enregistrée en brouillon.');
    }
    case 'class':
      return run(() => api.post('/school/classes', { level: str(fd, 'level'), name: str(fd, 'name'), capacity: Number(str(fd, 'capacity')) }), 'Classe créée.');
    case 'assign':
      return run(() => api.post('/school/assignments', { teacher: str(fd, 'teacher'), className: str(fd, 'className'), subject: str(fd, 'subject'), year: str(fd, 'year'), principal: flag(fd, 'principal') }), 'Affectation enregistrée.');
  }
  return null;
}

export default function Config({ loaderData: d, actionData }: Route.ComponentProps) {
  const link = (tab: string) => `/ecole/configuration?tab=${tab}`;
  return (
    <>
      <PageHeader kicker="Configuration · Lycée Léon Mba" title="Année, classes et affectations" />
      <Tabs items={[
        { to: link('annees'), label: 'Années scolaires', active: d.tab === 'annees' },
        { to: link('classes'), label: 'Classes', badge: String(d.classes.length), active: d.tab === 'classes' },
        { to: link('affect'), label: 'Affectations enseignants', active: d.tab === 'affect' },
      ]} />
      <ActionNotice result={actionData ?? undefined} />
      {d.tab === 'annees' && <YearForm year={d.year} />}
      {d.tab === 'classes' && <Classes classes={d.classes} />}
      {d.tab === 'affect' && <Assignments d={d} />}
    </>
  );
}

function YearForm({ year }: { year: Year }) {
  return (
    <Form method="post" className="flex flex-col gap-5">
      <Section title="Nouvelle année scolaire" note={year.active ? <Tag tone="hi">Active</Tag> : <Tag>Brouillon</Tag>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Libellé"><Input name="label" defaultValue={year.label} required /></Field>
          <Field label="Date de début"><Input name="start" type="date" defaultValue={year.start} required /></Field>
          <Field label="Date de fin"><Input name="end" type="date" defaultValue={year.end} required /></Field>
        </div>
      </Section>
      <Section title="Trimestres" note="Le coefficient pondère chaque trimestre dans la moyenne annuelle">
        <div className="flex flex-col gap-3">
          {year.terms.map((t, i) => (
            <div key={t.name} className="grid items-end gap-3 sm:grid-cols-[1.2fr_1fr_1fr_.6fr]">
              <Field label={i === 0 ? 'Trimestre' : ''}><Input name={`t${i}-name`} defaultValue={t.name} aria-label={`Nom du trimestre ${i + 1}`} required /></Field>
              <Field label={i === 0 ? 'Début' : ''}><Input name={`t${i}-start`} type="date" defaultValue={t.start} aria-label={`Début du trimestre ${i + 1}`} required /></Field>
              <Field label={i === 0 ? 'Fin' : ''}><Input name={`t${i}-end`} type="date" defaultValue={t.end} aria-label={`Fin du trimestre ${i + 1}`} required /></Field>
              <Field label={i === 0 ? 'Coefficient' : ''}><Input name={`t${i}-coef`} inputMode="decimal" defaultValue={t.coefficient} aria-label={`Coefficient du trimestre ${i + 1}`} className="tnum" required /></Field>
            </div>
          ))}
        </div>
      </Section>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit" name="intent" value="saveYear" variant="secondary">Créer en brouillon</Button>
        <Button type="submit" name="intent" value="activateYear" icon="power">Activer</Button>
      </div>
    </Form>
  );
}

function Classes({ classes }: { classes: ClassRow[] }) {
  const [level, setLevel] = useState('Collège');
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Section className="overflow-x-auto !p-0">
        <div className="min-w-[480px]">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-divider px-2 text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            {['Classe', 'Niveau', 'Effectif', 'Capacité'].map((h) => <div key={h} className="px-2 py-2.5">{h}</div>)}
          </div>
          {classes.map((c) => (
            <div key={c.id} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-divider px-2 py-2.5 text-[13.5px]">
              <div className="px-2">{c.name}</div><div className="px-2">{c.level}</div><div className="tnum px-2">{c.students}</div><div className="tnum px-2">{c.capacity}</div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Nouvelle classe">
        <Form method="post" className="flex flex-col gap-3">
          <input type="hidden" name="intent" value="class" /><input type="hidden" name="level" value={level} />
          <Field label="Niveau"><Chips name="level-ui" options={['Primaire', 'Collège', 'Lycée']} value={level} onChange={setLevel} /></Field>
          <Field label="Nom de la classe"><Input name="name" placeholder="Ex. 6ème A" required /></Field>
          <Field label="Capacité maximale"><Input name="capacity" type="number" min={1} defaultValue={40} className="tnum" required /></Field>
          <Button type="submit" icon="plus">Enregistrer</Button>
        </Form>
      </Section>
    </div>
  );
}

function Assignments({ d }: { d: Route.ComponentProps['loaderData'] }) {
  const [principal, setPrincipal] = useState(false);
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Section className="overflow-x-auto !p-0">
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[1.3fr_1fr_1.2fr_1fr] border-b border-divider px-2 text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            {['Enseignant', 'Classe', 'Matière', 'Rôle'].map((h) => <div key={h} className="px-2 py-2.5">{h}</div>)}
          </div>
          {d.assignments.map((a) => (
            <div key={a.id} className="grid grid-cols-[1.3fr_1fr_1.2fr_1fr] items-center border-b border-divider px-2 py-2.5 text-[13.5px]">
              <div className="px-2">{a.teacher}</div><div className="px-2">{a.className}</div><div className="px-2">{a.subject}</div>
              <div className="px-2">{a.principal ? <Tag tone="hi">Professeur principal</Tag> : <span className="text-neutral-700">Enseignant</span>}</div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Nouvelle affectation">
        <Form method="post" className="flex flex-col gap-3">
          <input type="hidden" name="intent" value="assign" /><input type="hidden" name="year" value={d.year.label} />
          <Field label="Enseignant"><Select name="teacher" required>{d.teachers.filter((t) => t.status === 'Activé').map((t) => <option key={t.id}>{t.name}</option>)}</Select></Field>
          <Field label="Classe"><Select name="className" required>{d.classes.map((c) => <option key={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Matière"><Input name="subject" placeholder="Ex. Mathématiques" required /></Field>
          <Field label="Année scolaire"><Input value={d.year.label} readOnly /></Field>
          <Toggle name="principal" label="Professeur principal" checked={principal} onChange={setPrincipal} />
          <Button type="submit" icon="plus">Enregistrer</Button>
        </Form>
      </Section>
    </div>
  );
}
