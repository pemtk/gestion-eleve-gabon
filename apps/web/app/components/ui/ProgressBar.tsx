/** Barre de progression fine (0 à 100 %), accessible comme une jauge. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}
