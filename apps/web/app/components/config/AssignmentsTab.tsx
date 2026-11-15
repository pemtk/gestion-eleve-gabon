import { useState } from 'react';
import { Form } from 'react-router';
import { Button, Field, Input, Section, Select, Tag, Toggle } from '~/components/ui';
import type { ClassRow, TeacherRow } from '~/lib/types';
import type { Assignment, Year } from './types';

interface Props {
  year: Year;
  classes: ClassRow[];
  teachers: TeacherRow[];
  assignments: Assignment[];
}

export function AssignmentsTab({ year, classes, teachers, assignments }: Props) {
  const [principal, setPrincipal] = useState(false);
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Section className="overflow-x-auto !p-0">
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[1.3fr_1fr_1.2fr_1fr] border-b border-divider px-2 text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            {['Enseignant', 'Classe', 'Matière', 'Rôle'].map((h) => (
              <div key={h} className="px-2 py-2.5">
                {h}
              </div>
            ))}
          </div>
          {assignments.map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-[1.3fr_1fr_1.2fr_1fr] items-center border-b border-divider px-2 py-2.5 text-[13.5px]"
            >
              <div className="px-2">{a.teacher}</div>
              <div className="px-2">{a.className}</div>
              <div className="px-2">{a.subject}</div>
              <div className="px-2">
                {a.principal ? (
                  <Tag tone="hi">Professeur principal</Tag>
                ) : (
                  <span className="text-neutral-700">Enseignant</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Nouvelle affectation">
        <Form method="post" className="flex flex-col gap-3">
          <input type="hidden" name="intent" value="assign" />
          <input type="hidden" name="year" value={year.label} />
          <Field label="Enseignant">
            <Select name="teacherId" required>
              {teachers
                .filter((t) => t.status === 'Activé')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Classe">
            <Select name="classId" required>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Matière">
            <Input name="subject" placeholder="Ex. Mathématiques" required />
          </Field>
          <Field label="Année scolaire">
            <Input value={year.label} readOnly />
          </Field>
          <Toggle
            name="principal"
            label="Professeur principal"
            checked={principal}
            onChange={setPrincipal}
          />
          <Button type="submit" icon="plus">
            Enregistrer
          </Button>
        </Form>
      </Section>
    </div>
  );
}
