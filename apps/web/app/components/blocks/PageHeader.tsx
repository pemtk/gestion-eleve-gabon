import { Icon } from '../icon';
import { Kicker } from '../ui';

export function PageHeader({
  kicker,
  title,
  filters = [],
  action,
}: {
  kicker: string;
  title: string;
  filters?: { icon: string; label: string }[];
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-divider pb-4.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-5">
      <div className="min-w-0 flex-1">
        <Kicker>{kicker}</Kicker>
        <h1 className="mt-1 text-[30px] leading-[1.05] sm:text-[40px]">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <div
            key={f.label}
            className="flex min-h-9.5 items-center gap-2 rounded-md border border-divider px-3 text-[13px]"
          >
            <Icon name={f.icon} size={15} className="text-neutral-600" />
            {f.label}
            <Icon name="chevron-down" size={14} className="text-neutral-600" />
          </div>
        ))}
        {action}
      </div>
    </header>
  );
}
