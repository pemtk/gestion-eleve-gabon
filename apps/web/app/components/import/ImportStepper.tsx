import { Icon } from '~/components/icon';
import { cx } from '~/components/ui';

interface Props {
  steps: string[];
  /** Numéro de l'étape en cours (1 = première). */
  current: number;
  done: boolean;
}

/** Les quatre étapes de l'import : modèle, fichier, vérification, validation. */
export function ImportStepper({ steps, current, done }: Props) {
  const active = done ? steps.length : current;
  return (
    <ol className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Étapes de l’import">
      {steps.map((label, index) => {
        const number = index + 1;
        const complete = done || number < active;
        const isCurrent = !done && number === active;
        return (
          <li
            key={label}
            aria-current={isCurrent ? 'step' : undefined}
            className={cx(
              'flex items-center gap-2.5 border-t-2 pt-3',
              complete || isCurrent ? 'border-accent' : 'border-divider',
            )}
          >
            <span
              className={cx(
                'grid h-7 w-7 flex-none place-items-center rounded-full border-[1.5px] font-heading text-[15px] font-semibold text-accent-800',
                complete
                  ? 'border-accent bg-accent-100'
                  : isCurrent
                    ? 'border-accent'
                    : 'border-divider',
              )}
            >
              {complete ? <Icon name="check" size={14} /> : number}
            </span>
            <span
              className={cx(
                'text-[14px]',
                isCurrent ? 'text-accent-800' : !complete && 'text-neutral-600',
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
