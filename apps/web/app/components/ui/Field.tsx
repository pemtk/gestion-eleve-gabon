import { Icon } from '../icon';
import { cx } from './cx';

/* ---------- Formulaires ---------- */
const FIELD =
  'w-full min-h-10 rounded-md border border-divider bg-transparent px-3 text-[14px] text-text caret-accent hover:border-neutral-500 focus-visible:border-accent focus-visible:outline-offset-0';

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className="text-[12.5px] text-neutral-700">{label}</span>
      {children}
      {hint && !error && <span className="text-[12px] text-neutral-600">{hint}</span>}
      {error && (
        <span className="flex items-center gap-1.5 text-[12px] text-accent-800">
          <Icon name="circle-alert" size={13} />
          {error}
        </span>
      )}
    </label>
  );
}

export const Input = ({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cx(FIELD, className)} {...p} />
);

export const Textarea = ({
  className,
  ...p
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cx(FIELD, 'min-h-24 py-2', className)} {...p} />
);

export const Select = ({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cx(FIELD, className)} {...p} />
);
