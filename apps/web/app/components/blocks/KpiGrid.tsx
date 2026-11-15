import type { Kpi } from '@sge/shared';
import { Icon } from '../icon';
import { cx } from '../ui';

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
      {kpis.map((k, i) => (
        <div
          key={k.label}
          className={cx(
            'flex flex-col gap-1 rounded-lg border p-4',
            i === 0 ? 'border-accent-300 bg-accent-100' : 'border-divider',
          )}
        >
          <div className="flex items-center justify-between text-[12.5px] text-neutral-700">
            <span>{k.label}</span>
            <Icon name={k.icon} size={16} className="text-accent-700" />
          </div>
          <div className="tnum font-heading text-[40px] leading-none">
            {k.value}
            <span className="text-[20px] text-neutral-600">{k.unit}</span>
          </div>
          <div className="text-[12px] text-neutral-600">{k.sub}</div>
        </div>
      ))}
    </div>
  );
}
