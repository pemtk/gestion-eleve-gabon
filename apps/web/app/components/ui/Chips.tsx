import { Icon } from '../icon';
import { cx } from './cx';

/** Choix exclusif sous forme de pastilles (case radio native, accessible au clavier). */
export function Chips({
  name,
  options,
  value,
  onChange,
  multiple,
}: {
  name: string;
  options: string[];
  value: string | string[];
  onChange: (v: string) => void;
  multiple?: boolean;
}) {
  const on = (o: string) => (Array.isArray(value) ? value.includes(o) : value === o);
  return (
    <div role={multiple ? 'group' : 'radiogroup'} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o}
          className={cx(
            'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-[13px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
            on(o)
              ? 'border-accent bg-accent-100 text-accent-800'
              : 'border-divider hover:bg-neutral-200',
          )}
        >
          <input
            type={multiple ? 'checkbox' : 'radio'}
            name={name}
            value={o}
            checked={on(o)}
            onChange={() => onChange(o)}
            className="sr-only"
          />
          {on(o) && <Icon name="check" size={13} />}
          {o}
        </label>
      ))}
    </div>
  );
}
