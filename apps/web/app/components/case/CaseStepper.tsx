import { Icon } from '~/components/icon';
import { cx } from '~/components/ui';

interface Props {
  steps: readonly string[];
  /** Délai ou précision affichés sous chaque étape. */
  hints: string[];
  current: number;
}

/** Avancement du dossier : accusé de réception, évaluation, suivi des mesures, clôture. */
export function CaseStepper({ steps, hints, current }: Props) {
  return (
    <ol className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Avancement du dossier">
      {steps.map((label, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={cx(
              'flex items-center gap-2.5 border-t-2 pt-3',
              done || active ? 'border-accent' : 'border-divider',
            )}
          >
            <span
              className={cx(
                'grid h-7 w-7 flex-none place-items-center rounded-full border-[1.5px] font-heading font-semibold text-accent-800',
                done
                  ? 'border-accent bg-accent-100'
                  : active
                    ? 'border-accent'
                    : 'border-divider text-neutral-600',
              )}
            >
              {done ? <Icon name="check" size={14} /> : number}
            </span>
            <span className="text-[14px] leading-tight">
              <span className={active ? 'text-accent-800' : done ? '' : 'text-neutral-600'}>
                {label}
              </span>
              <br />
              <span className="text-[11.5px] text-neutral-600">{hints[index]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
