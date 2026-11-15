import { Form } from 'react-router';
import { Button, Field, Input, Section, Tag } from '~/components/ui';
import type { Year } from './types';

export function YearForm({ year }: { year: Year }) {
  return (
    <Form method="post" className="flex flex-col gap-5">
      <Section
        title="Nouvelle année scolaire"
        note={year.active ? <Tag tone="hi">Active</Tag> : <Tag>Brouillon</Tag>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Libellé">
            <Input name="label" defaultValue={year.label} required />
          </Field>
          <Field label="Date de début">
            <Input name="start" type="date" defaultValue={year.start} required />
          </Field>
          <Field label="Date de fin">
            <Input name="end" type="date" defaultValue={year.end} required />
          </Field>
        </div>
      </Section>
      <Section
        title="Trimestres"
        note="Le coefficient pondère chaque trimestre dans la moyenne annuelle"
      >
        <div className="flex flex-col gap-3">
          {year.terms.map((t, i) => (
            <div key={t.name} className="grid items-end gap-3 sm:grid-cols-[1.2fr_1fr_1fr_.6fr]">
              <Field label={i === 0 ? 'Trimestre' : ''}>
                <Input
                  name={`t${i}-name`}
                  defaultValue={t.name}
                  aria-label={`Nom du trimestre ${i + 1}`}
                  required
                />
              </Field>
              <Field label={i === 0 ? 'Début' : ''}>
                <Input
                  name={`t${i}-start`}
                  type="date"
                  defaultValue={t.start}
                  aria-label={`Début du trimestre ${i + 1}`}
                  required
                />
              </Field>
              <Field label={i === 0 ? 'Fin' : ''}>
                <Input
                  name={`t${i}-end`}
                  type="date"
                  defaultValue={t.end}
                  aria-label={`Fin du trimestre ${i + 1}`}
                  required
                />
              </Field>
              <Field label={i === 0 ? 'Coefficient' : ''}>
                <Input
                  name={`t${i}-coef`}
                  inputMode="decimal"
                  defaultValue={t.coefficient}
                  aria-label={`Coefficient du trimestre ${i + 1}`}
                  className="tnum"
                  required
                />
              </Field>
            </div>
          ))}
        </div>
      </Section>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit" name="intent" value="saveYear" variant="secondary">
          Créer en brouillon
        </Button>
        <Button type="submit" name="intent" value="activateYear" icon="power">
          Activer
        </Button>
      </div>
    </Form>
  );
}
