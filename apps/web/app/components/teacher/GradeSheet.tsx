import { Form, useNavigation } from 'react-router';
import { Avatar, Button, Chips, Field, Input, Section } from '~/components/ui';
import type { ClassStudent } from './types';

const TRIMESTERS = ['T1', 'T2', 'T3'];

interface Props {
  students: ClassStudent[];
  trimester: string;
  onTrimester: (value: string) => void;
}

/** Saisie des notes d'une évaluation : une note sur 20 et un commentaire facultatif par élève ; les cases vides ne sont pas publiées. */
export function GradeSheet({ students, trimester, onTrimester }: Props) {
  const navigation = useNavigation();
  return (
    <Form method="post" className="flex flex-col gap-5">
      <input type="hidden" name="trimester" value={trimester} />
      <Section title="L’évaluation">
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <Field label="Intitulé">
            <Input name="label" required placeholder="Ex. Devoir surveillé n° 2" />
          </Field>
          <Field label="Coefficient">
            <Input
              name="coefficient"
              type="number"
              min="0.5"
              step="0.5"
              defaultValue="1"
              required
            />
          </Field>
        </div>
        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="mb-1 text-[12.5px] text-neutral-700">Trimestre</legend>
          <Chips
            name="trimester-choice"
            options={TRIMESTERS}
            value={trimester}
            onChange={onTrimester}
          />
        </fieldset>
      </Section>
      <Section
        title="Notes sur 20"
        note="Laissez vide un élève absent à l’évaluation"
        className="!p-0"
      >
        <ul>
          {students.map((student) => (
            <li
              key={student.id}
              className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 border-t border-divider px-5 py-2.5 sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1.2fr)]"
            >
              <span className="flex items-center gap-2.5 text-[14px]">
                <Avatar initials={student.initials} size={30} />
                {student.name}
              </span>
              <Input
                name={`grade-${student.id}`}
                type="number"
                inputMode="decimal"
                min="0"
                max="20"
                step="0.25"
                aria-label={`Note de ${student.name}`}
                className="tnum text-right"
              />
              <Input
                name={`comment-${student.id}`}
                aria-label={`Commentaire pour ${student.name}`}
                placeholder="Commentaire (facultatif)"
                className="col-span-2 sm:col-span-1"
              />
            </li>
          ))}
        </ul>
      </Section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-neutral-600">
          Une note publiée est vue aussitôt par l’élève et son parent ; seule l’école peut la
          corriger.
        </p>
        <Button type="submit" icon="send" disabled={navigation.state !== 'idle'}>
          Publier les notes
        </Button>
      </div>
    </Form>
  );
}
