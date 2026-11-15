import { useEffect, useRef } from 'react';

/* ---------- Boîte de dialogue (élément <dialog> natif : focus et Échap gérés) ---------- */
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(460px,calc(100%-2rem))] rounded-lg border border-divider bg-surface p-0 text-text shadow-lg backdrop:bg-neutral-900/50"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 className="text-[22px]">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
