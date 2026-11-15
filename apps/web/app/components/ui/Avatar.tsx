/* ---------- Avatar à initiales ---------- */
export function Avatar({ initials, size = 34 }: { initials: string; size?: number }) {
  return (
    <div
      aria-hidden
      style={{ width: size, height: size }}
      className="grid flex-none place-items-center rounded-full bg-accent-200 text-[12px] font-semibold text-accent-800"
    >
      {initials}
    </div>
  );
}
