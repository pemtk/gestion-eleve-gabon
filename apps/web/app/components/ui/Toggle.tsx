import { cx } from './cx';

export function Toggle({
  label,
  sub,
  checked,
  onChange,
  name,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  name?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-divider px-3.5 py-2.5">
      <span className="text-[14px]">
        {label}
        {sub && <span className="block text-[12px] text-neutral-600">{sub}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cx(
          'relative h-6 w-11 flex-none rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent',
          checked ? 'border-accent bg-accent-100' : 'border-neutral-400',
        )}
      >
        <span
          className={cx(
            'absolute top-[3px] h-4 w-4 rounded-full transition-all',
            checked ? 'left-[23px] bg-accent' : 'left-[3px] bg-neutral-400',
          )}
        />
      </span>
    </label>
  );
}
