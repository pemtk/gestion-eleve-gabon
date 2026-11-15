import { useState } from 'react';
import { Form, useNavigation } from 'react-router';
import { ATTENDANCE_STATUSES, JUSTIFICATIONS } from '@sge/shared';
import { Avatar, Button, Section, Select, cx } from '~/components/ui';
import type { AttendanceLine } from './types';

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
const summary = (present: number, absent: number, late: number) =>
  `${plural(present, 'présent')} · ${plural(absent, 'absent')} · ${late} en retard`;

const LABEL = { P: 'Présent', A: 'Absent', R: 'En retard' } as const;

/** Appel du jour : tout le monde est présent par défaut ; un absent ou un retardataire peut recevoir un motif. */
export function AttendanceSheet({ lines, date }: { lines: AttendanceLine[]; date: string }) {
  const navigation = useNavigation();
  const [status, setStatus] = useState<Record<string, AttendanceLine['status']>>(
    Object.fromEntries(lines.map((l) => [l.studentId, l.status])),
  );
  const absent = Object.values(status).filter((s) => s === 'A').length;
  const late = Object.values(status).filter((s) => s === 'R').length;

  return (
    <Form method="post" className="flex flex-col gap-4">
      <input type="hidden" name="date" value={date} />
      <Section title="Appel" note={summary(lines.length - absent - late, absent, late)}>
        <ul className="-mx-5 -mb-4.5">
          {lines.map((line) => {
            const current = status[line.studentId] ?? 'P';
            return (
              <li
                key={line.studentId}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-divider px-5 py-2.5"
              >
                <span className="flex min-w-48 flex-1 items-center gap-2.5 text-[14px]">
                  <Avatar initials={line.initials} size={30} />
                  {line.name}
                </span>
                <div
                  role="radiogroup"
                  aria-label={`Présence de ${line.name}`}
                  className="flex gap-1.5"
                >
                  {ATTENDANCE_STATUSES.map((code) => (
                    <label
                      key={code}
                      className={cx(
                        'inline-flex min-h-9 cursor-pointer items-center rounded-md border px-3 text-[13px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
                        current === code
                          ? 'border-accent bg-accent-100 text-accent-800'
                          : 'border-divider hover:bg-neutral-200',
                      )}
                    >
                      <input
                        type="radio"
                        name={`status-${line.studentId}`}
                        value={code}
                        checked={current === code}
                        onChange={() => setStatus((s) => ({ ...s, [line.studentId]: code }))}
                        className="sr-only"
                      />
                      {LABEL[code]}
                    </label>
                  ))}
                </div>
                {current !== 'P' && (
                  <Select
                    name={`justification-${line.studentId}`}
                    aria-label={`Motif pour ${line.name}`}
                    defaultValue={line.justification ?? ''}
                    className="!w-44"
                  >
                    <option value="">Motif non précisé</option>
                    {JUSTIFICATIONS.map((j) => (
                      <option key={j}>{j}</option>
                    ))}
                  </Select>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-neutral-600">
          Les parents des absents et des retardataires sont prévenus. L’appel peut être refait : il
          remplace le précédent.
        </p>
        <Button type="submit" icon="check" disabled={navigation.state !== 'idle'}>
          Enregistrer l’appel
        </Button>
      </div>
    </Form>
  );
}
