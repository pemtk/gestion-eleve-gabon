import { useState } from 'react';
import { Button, Field, Section, Textarea, Toggle, cx } from '~/components/ui';
import type { EvaluationValues } from './types';

const GRAVITIES: [level: string, hint: string][] = [
  ['Faible', 'suivi simple'],
  ['Modérée', 'mesures dans la semaine'],
  ['Élevée', 'protection immédiate'],
];

interface Props {
  initialGravity?: string;
  onSubmit: (values: EvaluationValues) => void;
}

/** Étape 2 : première évaluation (gravité, mesures envisagées, qui prévenir), sous 24 heures. */
export function EvaluationStep({ initialGravity = '', onSubmit }: Props) {
  const [gravity, setGravity] = useState(initialGravity);
  const [measures, setMeasures] = useState('');
  const [informDirector, setInformDirector] = useState(false);
  const [informFamily, setInformFamily] = useState(false);

  return (
    <Section title="Première évaluation">
      <div className="flex flex-col gap-4">
        <Field label="Gravité">
          <div className="grid gap-2 sm:grid-cols-3">
            {GRAVITIES.map(([level, hint]) => (
              <button
                key={level}
                type="button"
                aria-pressed={gravity === level}
                onClick={() => setGravity(level)}
                className={cx(
                  'rounded-lg border p-3 text-left',
                  gravity === level
                    ? 'border-[1.5px] border-accent bg-accent-100'
                    : 'border-divider hover:bg-neutral-200',
                )}
              >
                <div className="font-heading text-[18px] font-semibold">{level}</div>
                <div className="text-[12px] text-neutral-700">{hint}</div>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Mesures envisagées">
          <Textarea
            rows={3}
            value={measures}
            onChange={(event) => setMeasures(event.target.value)}
          />
        </Field>
        <Toggle
          label="Informer la directrice maintenant"
          sub="Elle reçoit le dossier complet."
          checked={informDirector}
          onChange={setInformDirector}
        />
        <Toggle
          label="Prévenir la famille"
          sub="Selon le protocole, sauf si cela met l’élève en danger."
          checked={informFamily}
          onChange={setInformFamily}
        />
        <Button
          icon="check"
          disabled={!gravity}
          onClick={() => onSubmit({ gravity, measures, informDirector, informFamily })}
        >
          Enregistrer l’évaluation
        </Button>
      </div>
    </Section>
  );
}
