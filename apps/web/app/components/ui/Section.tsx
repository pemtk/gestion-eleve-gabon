import { cx } from './cx';

/* ---------- Surfaces ---------- */
export function Section({
  title,
  note,
  children,
  className,
  dashed,
}: {
  title?: string;
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  dashed?: boolean;
}) {
  return (
    <section
      className={cx(
        'rounded-lg px-5 py-4.5',
        dashed ? 'border border-dashed border-accent-400' : 'border border-divider',
        className,
      )}
    >
      {(title || note) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className="text-[21px]">{title}</h2>}
          {note && <div className="text-[12px] text-neutral-600">{note}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('text-[11px] tracking-[.1em] uppercase text-accent-700', className)}>
      {children}
    </div>
  );
}
