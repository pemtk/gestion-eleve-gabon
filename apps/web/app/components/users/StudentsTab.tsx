import { useState } from 'react';
import { Form, Link, useNavigation } from 'react-router';
import {
  Button,
  Field,
  Input,
  LinkButton,
  Section,
  Select,
  Tag,
  cx,
  toneOf,
} from '~/components/ui';
import type { UsersData } from './types';
import { StudentDetail } from './StudentDetail';

export function StudentsTab({ d }: { d: UsersData }) {
  const [creating, setCreating] = useState(false);
  const nav = useNavigation();
  return (
    <>
      {!creating ? (
        <div className="flex flex-wrap gap-2">
          <Button icon="user-plus" onClick={() => setCreating(true)}>
            Nouvel élève
          </Button>
          <LinkButton variant="secondary" to="/ecole/utilisateurs/import" icon="upload">
            Importer un fichier CSV
          </LinkButton>
        </div>
      ) : (
        <Section title="Nouvel élève" note="Un SMS d’activation lui sera envoyé.">
          <Form
            method="post"
            onSubmit={() => setTimeout(() => setCreating(false), 0)}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <input type="hidden" name="intent" value="student" />
            <Field label="Nom">
              <Input name="lastName" placeholder="Ex. Mboumba" required />
            </Field>
            <Field label="Prénom">
              <Input name="firstName" placeholder="Ex. Ruth" required />
            </Field>
            <Field label="Téléphone">
              <Input name="phone" inputMode="tel" placeholder="+241 07 …" required />
            </Field>
            <Field label="Classe">
              <Select name="classId" required>
                {d.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button variant="secondary" onClick={() => setCreating(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={nav.state !== 'idle'}>
                Créer et envoyer le SMS
              </Button>
            </div>
          </Form>
        </Section>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Section className="overflow-x-auto !p-0">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[1.6fr_1fr_1fr_.8fr] border-b border-divider px-2 text-[11px] tracking-[.08em] text-neutral-700 uppercase">
              {['Élève', 'Classe', 'Compte', 'Parents'].map((h) => (
                <div key={h} className="px-2 py-2.5">
                  {h}
                </div>
              ))}
            </div>
            {d.students.map((s) => {
              const on = s.id === d.selected?.id;
              const acct =
                s.smsSent && !s.activated ? 'SMS envoyé' : s.activated ? 'Activé' : 'SMS non reçu';
              return (
                <Link
                  key={s.id}
                  to={`/ecole/utilisateurs?tab=eleves&eleve=${s.id}`}
                  preventScrollReset
                  aria-current={on || undefined}
                  className={cx(
                    'grid grid-cols-[1.6fr_1fr_1fr_.8fr] items-center border-b border-divider px-2 py-2.5 text-[13.5px] text-text no-underline hover:bg-neutral-100 hover:text-text',
                    on && 'bg-accent-100 shadow-[inset_2px_0_0_var(--color-accent)]',
                  )}
                >
                  <div className="px-2">
                    {s.firstName} {s.lastName}
                  </div>
                  <div className="px-2">{s.className}</div>
                  <div className="px-2">
                    <Tag tone={toneOf(acct)}>{acct}</Tag>
                  </div>
                  <div className={cx('tnum px-2', !s.parents.length && 'text-accent-800')}>
                    {s.parents.length ? `${s.parents.length} / 2` : 'aucun'}
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
        {d.selected && <StudentDetail s={d.selected} sms={d.sms} />}
      </div>
    </>
  );
}
