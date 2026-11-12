import { Link } from 'react-router';
import type { BarRow, DashboardData, Kpi, SideItem } from '@sge/shared';
import { Icon } from './icon';
import { Kicker, Section, Tag, cx, toneOf, LinkButton, Button } from './ui';

export function PageHeader({ kicker, title, filters = [], action }: { kicker: string; title: string; filters?: { icon: string; label: string }[]; action?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-5 border-b border-divider pb-4.5">
      <div className="min-w-0 flex-1">
        <Kicker>{kicker}</Kicker>
        <h1 className="mt-1 text-[40px] leading-[1.05]">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <div key={f.label} className="flex min-h-9.5 items-center gap-2 rounded-md border border-divider px-3 text-[13px]">
            <Icon name={f.icon} size={15} className="text-neutral-600" />
            {f.label}
            <Icon name="chevron-down" size={14} className="text-neutral-600" />
          </div>
        ))}
        {action}
      </div>
    </header>
  );
}

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
      {kpis.map((k, i) => (
        <div key={k.label} className={cx('flex flex-col gap-1 rounded-lg border p-4', i === 0 ? 'border-accent-300 bg-accent-100' : 'border-divider')}>
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

export function BarChart({ chart }: { chart: DashboardData['chart'] }) {
  return (
    <Section title={chart.title} note={chart.sub}>
      <div className="flex flex-col gap-2.5" role="list">
        {chart.rows.map((r: BarRow) => {
          const low = r.pct < 45;
          const masked = r.display === 'masqué';
          return (
            <div key={r.label} role="listitem" className="grid grid-cols-[110px_minmax(0,1fr)_54px] items-center gap-3 text-[13.5px] sm:grid-cols-[150px_minmax(0,1fr)_54px]">
              <span className="truncate">{r.label}</span>
              <div className="relative h-3.5 overflow-hidden rounded-[2px] bg-neutral-200">
                <div className={cx('h-full border-r-[1.5px] border-accent-700', low ? 'bg-accent-100' : 'bg-accent-300')} style={{ width: `${r.pct}%` }} />
              </div>
              <span className={cx('tnum text-right', masked ? 'text-[12px] italic text-neutral-600' : low ? 'text-accent-800' : '')}>{masked ? 'masqué' : (r.display ?? `${r.pct} %`)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3.5 flex items-center gap-4 text-[12px] text-neutral-600">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-accent-300" />{chart.legendA}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 border border-accent-700 bg-accent-100" />{chart.legendB}</span>
      </div>
    </Section>
  );
}

export function SideList({ title, items }: { title: string; items: SideItem[] }) {
  return (
    <Section title={title}>
      {items.map((a) => (
        <div key={a.title} className="flex gap-3 border-t border-divider py-3">
          <div className={cx('grid h-[34px] w-[34px] flex-none place-items-center rounded-full border border-accent-400 text-accent-700', a.highlight && 'bg-accent-100')}>
            <Icon name={a.icon} size={16} />
          </div>
          <div className="min-w-0 flex-1 text-[13.5px] leading-snug">
            <div className="font-semibold">{a.title}</div>
            <div className="text-neutral-700">{a.text}</div>
          </div>
          <span className="self-center whitespace-nowrap text-[12.5px] text-accent-700">{a.cta}</span>
        </div>
      ))}
    </Section>
  );
}

/** Tableau à colonnes en grille (même gabarit que le design : en-têtes en petites capitales). */
export function DataGrid({ title, note, columns, head, rows, empty }: { title?: string; note?: string; columns: string; head: string[]; rows: React.ReactNode[][]; empty?: string }) {
  return (
    <Section title={title} note={note} className="overflow-x-auto pb-2">
      <div role="table" className="min-w-[560px]" aria-label={title}>
        <div role="row" className="grid border-b border-divider text-[11px] tracking-[.08em] text-neutral-700 uppercase" style={{ gridTemplateColumns: columns }}>
          {head.map((h, i) => <div role="columnheader" key={`${h}-${i}`} className="px-2 py-2.5">{h}</div>)}
        </div>
        {rows.map((row, i) => (
          <div role="row" key={i} className="grid border-b border-divider text-[13.5px] hover:bg-neutral-100" style={{ gridTemplateColumns: columns }}>
            {row.map((cell, j) => <div role="cell" key={j} className="tnum flex items-center px-2 py-2.5">{cell}</div>)}
          </div>
        ))}
        {!rows.length && <div className="px-2 py-6 text-center text-[14px] italic text-neutral-600">{empty ?? 'Rien à afficher.'}</div>}
      </div>
    </Section>
  );
}

/** Cellule de tableau : étiquette d'état, valeur masquée (< 10) ou texte. */
export function Cell({ children }: { children: string }) {
  if (children.startsWith('masqué')) return <span className="text-[12.5px] italic text-neutral-600">&lt; 10 · masqué</span>;
  const tone = toneOf(children);
  return tone === 'n' && !/^(Essai|Ouvert|En cours)/.test(children) ? <span>{children}</span> : <Tag tone={tone}>{children}</Tag>;
}

/** Fonction non incluse dans la formule de l'établissement. */
export function LockedCard({ plan, title, text, ctaTo = '/ecole/abonnement' }: { plan: string; title: string; text: string; ctaTo?: string }) {
  return (
    <Section dashed className="flex flex-col items-start gap-3 !p-6">
      <div className="flex items-center gap-2.5">
        <div className="grid h-[38px] w-[38px] place-items-center rounded-full border border-accent-400 text-accent-700"><Icon name="lock" size={17} /></div>
        <Kicker>Formule {plan}</Kicker>
      </div>
      <h2 className="text-2xl">{title}</h2>
      <p className="max-w-prose text-[14px] leading-relaxed text-neutral-700">{text}</p>
      <div className="flex flex-wrap gap-2">
        <LinkButton to={ctaTo}>Comparer les formules</LinkButton>
      </div>
    </Section>
  );
}

/** Abonnement suspendu : consultation seule. */
export function SuspendedBanner() {
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg border border-accent-400 bg-accent-100 px-4 py-3 text-[13.5px] text-accent-900">
      <Icon name="circle-pause" size={18} />
      <div className="flex-1 leading-snug"><strong className="font-semibold">Abonnement suspendu</strong> · consultation seule. Les données sont conservées ; réglez la facture pour réactiver toutes les fonctions.</div>
      <Link to="/ecole/abonnement" className="font-semibold">Mon abonnement</Link>
    </div>
  );
}

export function EmptyState({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-accent-400 text-accent-700"><Icon name={icon} size={22} /></div>
      <div className="font-heading text-[22px]">{title}</div>
      {text && <p className="max-w-sm text-[14px] text-neutral-700">{text}</p>}
    </div>
  );
}

export { Link, Button };
