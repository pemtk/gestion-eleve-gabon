import type { ConfidentialCase } from '@sge/shared';
import { Section } from '~/components/ui';

/** Fiche du dossier : type, auteur, classe, élève concerné, date de réception et texte du signalement. */
export function CaseSummary({ info }: { info: ConfidentialCase }) {
  const rows: [label: string, value: string][] = [
    ['Type', info.type],
    ['Ouvert par', info.reporter],
    ['Classe', info.className],
    ['Élève concerné', info.student],
    ['Reçu', info.received],
  ];
  return (
    <Section title="Le dossier">
      <dl className="text-[14px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-t border-divider py-2">
            <dt className="text-neutral-700">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-l-2 border-accent pl-3 text-[14px] italic leading-relaxed">
        « {info.text} »
      </p>
    </Section>
  );
}
