import type { BarRow, DashboardData } from '@sge/shared';
import { Section, cx } from '../ui';

export function BarChart({ chart }: { chart: DashboardData['chart'] }) {
  return (
    <Section title={chart.title} note={chart.sub}>
      <div className="flex flex-col gap-2.5" role="list">
        {chart.rows.map((r: BarRow) => {
          const low = r.pct < 45;
          const masked = r.display === 'masqué';
          return (
            <div
              key={r.label}
              role="listitem"
              className="grid grid-cols-[110px_minmax(0,1fr)_54px] items-center gap-3 text-[13.5px] sm:grid-cols-[150px_minmax(0,1fr)_54px]"
            >
              <span className="truncate">{r.label}</span>
              <div className="relative h-3.5 overflow-hidden rounded-[2px] bg-neutral-200">
                <div
                  className={cx(
                    'h-full border-r-[1.5px] border-accent-700',
                    low ? 'bg-accent-100' : 'bg-accent-300',
                  )}
                  style={{ width: `${r.pct}%` }}
                />
              </div>
              <span
                className={cx(
                  'tnum text-right',
                  masked ? 'text-[12px] italic text-neutral-600' : low ? 'text-accent-800' : '',
                )}
              >
                {masked ? 'masqué' : (r.display ?? `${r.pct} %`)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3.5 flex items-center gap-4 text-[12px] text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-accent-300" />
          {chart.legendA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 border border-accent-700 bg-accent-100" />
          {chart.legendB}
        </span>
      </div>
    </Section>
  );
}
