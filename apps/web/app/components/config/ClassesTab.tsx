import { useState } from 'react';
import { Form } from 'react-router';
import { Button, Chips, Field, Input, Section } from '~/components/ui';
import type { ClassRow } from '~/lib/types';

export function ClassesTab({ classes }: { classes: ClassRow[] }) {
  const [level, setLevel] = useState('Collège');
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Section className="overflow-x-auto !p-0">
        <div className="min-w-[480px]">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-divider px-2 text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            {['Classe', 'Niveau', 'Effectif', 'Capacité'].map((h) => (
              <div key={h} className="px-2 py-2.5">
                {h}
              </div>
            ))}
          </div>
          {classes.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-divider px-2 py-2.5 text-[13.5px]"
            >
              <div className="px-2">{c.name}</div>
              <div className="px-2">{c.level}</div>
              <div className="tnum px-2">{c.students}</div>
              <div className="tnum px-2">{c.capacity}</div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Nouvelle classe">
        <Form method="post" className="flex flex-col gap-3">
          <input type="hidden" name="intent" value="class" />
          <input type="hidden" name="level" value={level} />
          <Field label="Niveau">
            <Chips
              name="level-ui"
              options={['Primaire', 'Collège', 'Lycée']}
              value={level}
              onChange={setLevel}
            />
          </Field>
          <Field label="Nom de la classe">
            <Input name="name" placeholder="Ex. 6ème A" required />
          </Field>
          <Field label="Capacité maximale">
            <Input
              name="capacity"
              type="number"
              min={1}
              defaultValue={40}
              className="tnum"
              required
            />
          </Field>
          <Button type="submit" icon="plus">
            Enregistrer
          </Button>
        </Form>
      </Section>
    </div>
  );
}
