import { useEffect, useState } from 'react';
import { Icon } from '../icon';
import { cx } from './cx';

/* ---------- Retours à l'utilisateur ---------- */
export function Notice({
  tone = 'ok',
  children,
}: {
  tone?: 'ok' | 'error' | 'info';
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex items-center gap-2.5 rounded-md border px-4 py-2.5 text-[13.5px]',
        tone === 'error'
          ? 'border-accent-400 bg-accent-200 text-accent-900'
          : 'border-accent-300 bg-accent-100 text-accent-800',
      )}
    >
      <Icon
        name={tone === 'error' ? 'circle-alert' : tone === 'info' ? 'info' : 'circle-check'}
        size={16}
      />
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** Affiche le résultat d'une action (succès ou erreur) ; disparaît après quelques secondes. */
export function ActionNotice({
  result,
}: {
  result?: { ok: true; message: string } | { ok: false; error: string };
}) {
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
