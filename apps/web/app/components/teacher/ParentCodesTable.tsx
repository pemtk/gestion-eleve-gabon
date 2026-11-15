import { Avatar, Section, Tag } from '~/components/ui';
import type { ParentCodeRow } from './types';

/** Élèves d'une classe avec le code d'invitation à remettre aux parents et le nombre de parents déjà rattachés. */
export function ParentCodesTable({
  rows,
  className,
}: {
  rows: ParentCodeRow[];
  className: string;
}) {
  return (
    <Section
      title={`Élèves de ${className}`}
      note={`${rows.length} élèves`}
      className="overflow-x-auto !p-0"
    >
      <table className="w-full min-w-[520px] text-[14px]">
        <thead>
          <tr className="border-b border-divider text-left text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            <th className="px-5 py-2.5 font-normal">Élève</th>
            <th className="px-3 py-2.5 font-normal">Code parent</th>
            <th className="px-3 py-2.5 font-normal">Parents rattachés</th>
            <th className="px-5 py-2.5 text-right font-normal">Valable jusqu’au</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.studentId} className="border-b border-divider last:border-0">
              <td className="px-5 py-2.5">
                <span className="flex items-center gap-2.5">
                  <Avatar initials={row.initials} size={30} />
                  {row.name}
                </span>
              </td>
              <td className="tnum px-3 py-2.5 font-mono tracking-wider">{row.code}</td>
              <td className="px-3 py-2.5">
                <Tag tone={row.linked ? 'hi' : 'n'}>{row.linked} sur 2</Tag>
              </td>
              <td className="px-5 py-2.5 text-right text-neutral-700">{row.validUntil}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
