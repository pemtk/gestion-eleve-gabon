import { Section, Tag, toneOf } from '../ui';

/** Tableau à colonnes en grille (même gabarit que le design : en-têtes en petites capitales). */
export function DataGrid({
  title,
  note,
  columns,
  head,
  rows,
  empty,
}: {
  title?: string;
  note?: string;
  columns: string;
  head: string[];
  rows: React.ReactNode[][];
  empty?: string;
}) {
  return (
    <Section title={title} note={note} className="overflow-x-auto pb-2">
      <div role="table" className="min-w-[560px]" aria-label={title}>
        <div
          role="row"
          className="grid border-b border-divider text-[11px] tracking-[.08em] text-neutral-700 uppercase"
          style={{ gridTemplateColumns: columns }}
        >
          {head.map((h, i) => (
            <div role="columnheader" key={`${h}-${i}`} className="px-2 py-2.5">
              {h}
            </div>
          ))}
        </div>
        {rows.map((row, i) => (
          <div
            role="row"
            key={i}
            className="grid border-b border-divider text-[13.5px] hover:bg-neutral-100"
            style={{ gridTemplateColumns: columns }}
          >
            {row.map((cell, j) => (
              <div role="cell" key={j} className="tnum flex items-center px-2 py-2.5">
                {cell}
              </div>
            ))}
          </div>
        ))}
        {!rows.length && (
          <div className="px-2 py-6 text-center text-[14px] italic text-neutral-600">
            {empty ?? 'Rien à afficher.'}
          </div>
        )}
      </div>
    </Section>
  );
}

/** Cellule de tableau : étiquette d'état, valeur masquée (< 10) ou texte. */
export function Cell({ children }: { children: string }) {
  if (children.startsWith('masqué'))
    return <span className="text-[12.5px] italic text-neutral-600">&lt; 10 · masqué</span>;
  const tone = toneOf(children);
  return tone === 'n' && !/^(Essai|Ouvert|En cours)/.test(children) ? (
    <span>{children}</span>
  ) : (
    <Tag tone={tone}>{children}</Tag>
  );
}
