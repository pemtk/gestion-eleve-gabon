import { useSearchParams } from 'react-router';
import { Select } from '~/components/ui';
import { classKey } from './class-selection';
import type { TeacherClass } from './types';

interface Props {
  classes: TeacherClass[];
  selected: TeacherClass | null;
  /** Afficher la matière à côté de la classe (notes, tâches) ou seulement la classe. */
  withSubject?: boolean;
}

/** Choix de la classe : le choix vit dans l'adresse (`?classe=`), la page se recharge avec les données de cette classe. */
export function ClassPicker({ classes, selected, withSubject = true }: Props) {
  const [params, setParams] = useSearchParams();
  if (classes.length < 2 && selected)
    return (
      <p className="text-[14px] text-neutral-700">
        Classe : <strong className="font-semibold text-text">{selected.name}</strong>
        {withSubject && ` · ${selected.subject}`}
      </p>
    );
  return (
    <label className="flex items-center gap-2 text-[13px] text-neutral-700">
      Classe
      <Select
        value={selected ? classKey(selected) : ''}
        onChange={(event) => {
          const next = new URLSearchParams(params);
          next.set('classe', event.target.value);
          setParams(next);
        }}
        className="!w-auto"
      >
        {classes.map((c) => (
          <option key={classKey(c)} value={classKey(c)}>
            {withSubject ? `${c.name} · ${c.subject}` : c.name}
          </option>
        ))}
      </Select>
    </label>
  );
}
