import { Link, type LinkProps } from 'react-router';
import { Icon } from '../icon';
import { cx } from './cx';

/* ---------- Boutons : contours dorés, jamais de plein ---------- */
const BTN =
  'inline-flex items-center justify-center gap-2 rounded-md font-heading font-semibold cursor-pointer no-underline transition-colors disabled:pointer-events-none';

const VARIANTS = {
  primary:
    'min-h-10 px-4 text-[15px] border-[1.5px] border-accent bg-accent-100 text-accent-800 hover:bg-accent-200 active:bg-accent-300 hover:text-accent-800',
  secondary:
    'min-h-10 px-4 text-[15px] border border-divider text-text bg-transparent hover:bg-neutral-200 hover:text-text',
  ghost: 'min-h-8 px-2 text-[14px] text-accent-700 hover:bg-accent-100 hover:text-accent-800',
} as const;

type Variant = keyof typeof VARIANTS;

export function Button({
  variant = 'primary',
  icon,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: string }) {
  return (
    <button type="button" className={cx(BTN, VARIANTS[variant], className)} {...rest}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = 'primary',
  icon,
  className,
  children,
  ...rest
}: LinkProps & { variant?: Variant; icon?: string }) {
  return (
    <Link className={cx(BTN, VARIANTS[variant], className)} {...rest}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </Link>
  );
}
