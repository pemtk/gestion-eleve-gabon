import { useState } from 'react';
import { Button, Chips, Field, Input, Section, cx } from '~/components/ui';
import type { CaseAction } from './types';

const OWNERS = ['Référente', 'Directrice', 'Prof. principal'];

interface Props {
  actions: CaseAction[];
  onToggle: (index: number) => void;
  onAdd: (label: string, owner: string) => void;
  onPrepareClose: () => void;
}

/** Étape 3 : plan d'action. Cocher une action la marque faite ; il en faut au moins une pour passer à la clôture. */
export function ActionPlanStep({ actions, onToggle, onAdd, onPrepareClose }: Props) {
  const [label, setLabel] = useState('');
  const [owner, setOwner] = useState(OWNERS[0]!);
  const done = actions.filter((action) => action.done).length;

  const add = () => {
    if (!label.trim()) return;
    onAdd(label.trim(), owner);
    setLabel('');
  };

  return (
    <Section title="Plan d’action" note={`${done} / ${actions.length} faites`}>
      {actions.map((action, index) => (
        <label
          key={`${action.label}-${index}`}
          className="flex cursor-pointer items-center gap-3 border-t border-divider py-2.5"
        >
          <input
            type="checkbox"
            checked={action.done}
            onChange={() => onToggle(index)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          <span className={cx('flex-1 text-[14px]', action.done && 'line-through opacity-60')}>
            {action.label}
            <span className="block text-[12px] text-neutral-600">
              {action.owner} · {action.due}
            </span>
          </span>
        </label>
      ))}
      {!actions.length && (
        <p className="py-2 text-[13.5px] italic text-neutral-600">Aucune action pour l’instant.</p>
      )}
      <div className="mt-3 flex flex-col gap-3 border-t border-divider pt-4">
        <Field label="Nouvelle action">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Ex. Entretien avec l’élève"
          />
        </Field>
        <Chips name="owner" options={OWNERS} value={owner} onChange={setOwner} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" icon="plus" onClick={add}>
            Ajouter
          </Button>
          <Button disabled={!actions.length} onClick={onPrepareClose}>
            Passer à la clôture
          </Button>
        </div>
      </div>
    </Section>
  );
}
