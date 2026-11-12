import { useEffect, useRef, useState } from 'react';
import { Link, type LinkProps } from 'react-router';
import { Icon } from './icon';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* ---------- Boutons : contours dorés, jamais de plein ---------- */
const BTN = 'inline-flex items-center justify-center gap-2 rounded-md font-heading font-semibold cursor-pointer no-underline transition-colors disabled:pointer-events-none';
const VARIANTS = {
  primary: 'min-h-10 px-4 text-[15px] border-[1.5px] border-accent bg-accent-100 text-accent-800 hover:bg-accent-200 active:bg-accent-300 hover:text-accent-800',
  secondary: 'min-h-10 px-4 text-[15px] border border-divider text-text bg-transparent hover:bg-neutral-200 hover:text-text',
  ghost: 'min-h-8 px-2 text-[14px] text-accent-700 hover:bg-accent-100 hover:text-accent-800',
} as const;
type Variant = keyof typeof VARIANTS;

export function Button({ variant = 'primary', icon, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: string }) {
  return (
    <button type="button" className={cx(BTN, VARIANTS[variant], className)} {...rest}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function LinkButton({ variant = 'primary', icon, className, children, ...rest }: LinkProps & { variant?: Variant; icon?: string }) {
  return (
    <Link className={cx(BTN, VARIANTS[variant], className)} {...rest}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </Link>
  );
}

/* ---------- Étiquettes d'état ---------- */
const TONES = { hi: 'bg-accent-100 text-accent-800', warn: 'bg-accent-200 text-accent-900', n: 'bg-neutral-200 text-neutral-800' } as const;
export type Tone = keyof typeof TONES;
export function Tag({ tone = 'n', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center rounded-[3px] px-2.5 py-0.5 text-[12px]', TONES[tone], className)}>{children}</span>;
}

/** Même lecture que le design : Actif/À jour = doré clair, Suspendu/Faible/En retard = doré marqué, le reste neutre. */
export function toneOf(label: string): Tone {
  if (/^(Actif|Activé|À jour|Validé|Résolu|Clos)/.test(label)) return 'hi';
  if (/^(Suspendu|En retard|Faible|Échec|À relancer|Invitation expirée|SMS non reçu|Refusé)/.test(label)) return 'warn';
  return 'n';
}

/* ---------- Surfaces ---------- */
export function Section({ title, note, children, className, dashed }: { title?: string; note?: React.ReactNode; children: React.ReactNode; className?: string; dashed?: boolean }) {
  return (
    <section className={cx('rounded-lg px-5 py-4.5', dashed ? 'border border-dashed border-accent-400' : 'border border-divider', className)}>
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
  return <div className={cx('text-[11px] tracking-[.1em] uppercase text-accent-700', className)}>{children}</div>;
}

/* ---------- Formulaires ---------- */
const FIELD = 'w-full min-h-10 rounded-md border border-divider bg-transparent px-3 text-[14px] text-text caret-accent hover:border-neutral-500 focus-visible:border-accent focus-visible:outline-offset-0';
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className="text-[12.5px] text-neutral-700">{label}</span>
      {children}
      {hint && !error && <span className="text-[12px] text-neutral-600">{hint}</span>}
      {error && <span className="flex items-center gap-1.5 text-[12px] text-accent-800"><Icon name="circle-alert" size={13} />{error}</span>}
    </label>
  );
}
export const Input = ({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) => <input className={cx(FIELD, className)} {...p} />;
export const Textarea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cx(FIELD, 'min-h-24 py-2', className)} {...p} />;
export const Select = ({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select className={cx(FIELD, className)} {...p} />;

/** Choix exclusif sous forme de pastilles (case radio native, accessible au clavier). */
export function Chips({ name, options, value, onChange, multiple }: { name: string; options: string[]; value: string | string[]; onChange: (v: string) => void; multiple?: boolean }) {
  const on = (o: string) => (Array.isArray(value) ? value.includes(o) : value === o);
  return (
    <div role={multiple ? 'group' : 'radiogroup'} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o} className={cx('inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-[13px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent', on(o) ? 'border-accent bg-accent-100 text-accent-800' : 'border-divider hover:bg-neutral-200')}>
          <input type={multiple ? 'checkbox' : 'radio'} name={name} value={o} checked={on(o)} onChange={() => onChange(o)} className="sr-only" />
          {on(o) && <Icon name="check" size={13} />}
          {o}
        </label>
      ))}
    </div>
  );
}

export function Toggle({ label, sub, checked, onChange, name }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; name?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-divider px-3.5 py-2.5">
      <span className="text-[14px]">{label}{sub && <span className="block text-[12px] text-neutral-600">{sub}</span>}</span>
      <input type="checkbox" role="switch" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className={cx('relative h-6 w-11 flex-none rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent', checked ? 'border-accent bg-accent-100' : 'border-neutral-400')}>
        <span className={cx('absolute top-[3px] h-4 w-4 rounded-full transition-all', checked ? 'left-[23px] bg-accent' : 'left-[3px] bg-neutral-400')} />
      </span>
    </label>
  );
}

/* ---------- Onglets (état dans l'URL) ---------- */
export function Tabs({ items }: { items: { to: string; label: string; badge?: string; active: boolean }[] }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-divider">
      {items.map((t) => (
        <Link key={t.to} to={t.to} role="tab" aria-selected={t.active} preventScrollReset className={cx('-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-[14px] no-underline', t.active ? 'border-accent text-accent-800' : 'border-transparent text-neutral-700 hover:text-text')}>
          {t.label}
          {t.badge && <span className="tnum rounded-full bg-neutral-200 px-2 text-[11px]">{t.badge}</span>}
        </Link>
      ))}
    </div>
  );
}

/* ---------- Retours à l'utilisateur ---------- */
export function Notice({ tone = 'ok', children }: { tone?: 'ok' | 'error' | 'info'; children: React.ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex items-center gap-2.5 rounded-md border px-4 py-2.5 text-[13.5px]', tone === 'error' ? 'border-accent-400 bg-accent-200 text-accent-900' : 'border-accent-300 bg-accent-100 text-accent-800')}>
      <Icon name={tone === 'error' ? 'circle-alert' : tone === 'info' ? 'info' : 'circle-check'} size={16} />
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** Affiche le résultat d'une action (succès ou erreur) ; disparaît après quelques secondes. */
export function ActionNotice({ result }: { result?: { ok: true; message: string } | { ok: false; error: string } }) {
  const [shown, setShown] = useState(result);
  useEffect(() => {
    setShown(result);
    if (!result?.ok) return;
    const t = setTimeout(() => setShown(undefined), 4000);
    return () => clearTimeout(t);
  }, [result]);
  if (!shown) return null;
  return shown.ok ? <Notice>{shown.message}</Notice> : <Notice tone="error">{shown.error}</Notice>;
}

/* ---------- Boîte de dialogue (élément <dialog> natif : focus et Échap gérés) ---------- */
export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} className="m-auto w-[min(460px,calc(100%-2rem))] rounded-lg border border-divider bg-surface p-0 text-text shadow-lg backdrop:bg-neutral-900/50">
      <div className="flex flex-col gap-3 p-5">
        <h2 className="text-[22px]">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

/* ---------- Avatar à initiales ---------- */
export function Avatar({ initials, size = 34 }: { initials: string; size?: number }) {
  return (
    <div aria-hidden style={{ width: size, height: size }} className="grid flex-none place-items-center rounded-full bg-accent-200 text-[12px] font-semibold text-accent-800">
      {initials}
    </div>
  );
}
