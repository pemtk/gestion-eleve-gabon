import { cx } from './cx';

/* ---------- Étiquettes d'état ---------- */
const TONES = {
  hi: 'bg-accent-100 text-accent-800',
  warn: 'bg-accent-200 text-accent-900',
  n: 'bg-neutral-200 text-neutral-800',
} as const;

export type Tone = keyof typeof TONES;

export function Tag({
  tone = 'n',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-[3px] px-2.5 py-0.5 text-[12px]',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Même lecture que le design : Actif/À jour = doré clair, Suspendu/Faible/En retard = doré marqué, le reste neutre. */
export function toneOf(label: string): Tone {
  if (/^(Actif|Activé|À jour|Validé|Résolu|Clos)/.test(label)) return 'hi';
  if (
    /^(Suspendu|En retard|Faible|Échec|À relancer|Invitation expirée|SMS non reçu|Refusé)/.test(
      label,
    )
  )
    return 'warn';
  return 'n';
}
