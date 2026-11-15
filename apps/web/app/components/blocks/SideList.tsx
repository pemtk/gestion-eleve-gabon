import { Link } from 'react-router';
import type { SideItem } from '@sge/shared';
import { Icon } from '../icon';
import { Section, cx } from '../ui';

export function SideList({ title, items }: { title: string; items: SideItem[] }) {
  return (
    <Section title={title}>
      {items.map((a) => (
        <div key={a.title} className="flex gap-3 border-t border-divider py-3">
          <div
            className={cx(
              'grid h-[34px] w-[34px] flex-none place-items-center rounded-full border border-accent-400 text-accent-700',
              a.highlight && 'bg-accent-100',
            )}
          >
            <Icon name={a.icon} size={16} />
          </div>
          <div className="min-w-0 flex-1 text-[13.5px] leading-snug">
            <div className="font-semibold">{a.title}</div>
            <div className="text-neutral-700">{a.text}</div>
          </div>
          {a.to && a.cta && (
            <Link to={a.to} className="self-center whitespace-nowrap text-[12.5px]">
              {a.cta}
            </Link>
          )}
        </div>
      ))}
    </Section>
  );
}
