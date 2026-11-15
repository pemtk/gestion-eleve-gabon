import { Link } from 'react-router';
import { cx } from './cx';

/* ---------- Onglets (état dans l'URL) ---------- */
export function Tabs({
  items,
}: {
  items: { to: string; label: string; badge?: string; active: boolean }[];
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-divider">
      {items.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          role="tab"
          aria-selected={t.active}
          preventScrollReset
          className={cx(
            '-mb-px flex flex-none items-center gap-2 border-b-2 px-4 py-2.5 text-[14px] whitespace-nowrap no-underline',
            t.active
              ? 'border-accent text-accent-800'
              : 'border-transparent text-neutral-700 hover:text-text',
          )}
        >
          {t.label}
          {t.badge && (
            <span className="tnum rounded-full bg-neutral-200 px-2 text-[11px]">{t.badge}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
