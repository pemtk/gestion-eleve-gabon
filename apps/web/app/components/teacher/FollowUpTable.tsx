import { useState } from 'react';
import { Form, useNavigation } from 'react-router';
import { Icon } from '~/components/icon';
import { Avatar, Button, Section, Tag, type Tone } from '~/components/ui';
import type { FollowUpRow } from './types';

const STATUS: Record<FollowUpRow['status'], { label: string; tone: Tone }> = {
  none: { label: 'Pas commencé', tone: 'n' },
  doing: { label: 'En cours', tone: 'n' },
  done: { label: 'Terminé', tone: 'hi' },
  redo: { label: 'À refaire', tone: 'warn' },
};

/** Avancement élève par élève : statut, temps passé, auto-évaluation, preuve ; l'enseignant peut invalider une tâche terminée. */
export function FollowUpTable({ rows }: { rows: FollowUpRow[] }) {
  return (
    <Section className="overflow-x-auto !p-0">
      <table className="w-full min-w-[720px] text-[14px]">
        <thead>
          <tr className="border-b border-divider text-left text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            <th className="px-5 py-2.5 font-normal">Élève</th>
            <th className="px-3 py-2.5 font-normal">Statut</th>
            <th className="px-3 py-2.5 font-normal">Temps</th>
            <th className="px-3 py-2.5 font-normal">Auto-évaluation</th>
            <th className="px-3 py-2.5 font-normal">Preuve</th>
            <th className="px-5 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <FollowUpLine key={row.studentId} row={row} />
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function FollowUpLine({ row }: { row: FollowUpRow }) {
  const navigation = useNavigation();
  const [asking, setAsking] = useState(false);
  const status = STATUS[row.status];
  return (
    <tr className="border-b border-divider last:border-0">
      <td className="px-5 py-2.5">
        <span className="flex items-center gap-2.5">
          <Avatar initials={row.initials} size={30} />
          {row.name}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <Tag tone={status.tone}>{status.label}</Tag>
      </td>
      <td className="tnum px-3 py-2.5 text-neutral-700">{row.time}</td>
      <td className="px-3 py-2.5">
        {row.evaluation === 'doubt' ? (
          <Tag tone="warn">J’ai des doutes</Tag>
        ) : row.evaluation ? (
          <span className="text-neutral-700">Compris</span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-2.5">
        {row.proofFileId ? (
          <a
            href={`/fichiers/${row.proofFileId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5"
          >
            <Icon name="image" size={14} /> Voir la photo
          </a>
        ) : (
          <span className="text-neutral-600">{row.proof ? 'Oui' : '—'}</span>
        )}
      </td>
      <td className="px-5 py-2.5 text-right">
        {row.status === 'done' &&
          (asking ? (
            <span className="inline-flex items-center gap-2 text-[13px]">
              Annuler les points ?
              <Form method="post" onSubmit={() => setAsking(false)}>
                <input type="hidden" name="studentId" value={row.studentId} />
                <Button type="submit" variant="ghost" disabled={navigation.state !== 'idle'}>
                  Invalider
                </Button>
              </Form>
              <Button variant="ghost" onClick={() => setAsking(false)}>
                Garder
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => setAsking(true)}>
              Invalider
            </Button>
          ))}
      </td>
    </tr>
  );
}
