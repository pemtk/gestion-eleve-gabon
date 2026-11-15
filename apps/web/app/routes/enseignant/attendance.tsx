import { useActionData, useSearchParams } from 'react-router';
import { ATTENDANCE_STATUSES } from '@sge/shared';
import { PageHeader } from '~/components/blocks';
import { AttendanceSheet } from '~/components/teacher/AttendanceSheet';
import { ClassPicker } from '~/components/teacher/ClassPicker';
import { NoClass } from '~/components/teacher/NoClass';
import { todayIso } from '~/components/teacher/today';
import type { AttendanceLine } from '~/components/teacher/types';
import { Input, Notice } from '~/components/ui';
import { run } from '~/lib/api.server';
import { str } from '~/lib/form';
import { classContext } from '~/lib/teacher.server';
import type { Route } from './+types/attendance';

const dateOf = (request: Request) => new URL(request.url).searchParams.get('date') ?? todayIso();

export async function loader({ request }: Route.LoaderArgs) {
  const { api, classes, selected } = await classContext(request);
  const date = dateOf(request);
  const lines = selected
    ? await api.get<AttendanceLine[]>(
        `/me/teacher/attendance?classId=${encodeURIComponent(selected.id)}&date=${date}`,
      )
    : [];
  return { classes, selected, date, lines };
}

export async function action({ request }: Route.ActionArgs) {
  const { api, selected } = await classContext(request);
  const fd = await request.formData();
  if (!selected) return { ok: false as const, error: 'Choisissez une de vos classes.' };
  const entries = [...fd.keys()]
    .filter((key) => key.startsWith('status-'))
    .map((key) => {
      const studentId = key.slice('status-'.length);
      const status = str(fd, key);
      const justification = str(fd, `justification-${studentId}`);
      return {
        studentId,
        status,
        justification: status !== 'P' && justification ? justification : undefined,
      };
    })
    .filter((e) => (ATTENDANCE_STATUSES as readonly string[]).includes(e.status));
  return run(
    () =>
      api.post<{ saved: number; parentsNotified: number }>('/me/teacher/attendance', {
        classId: selected.id,
        date: str(fd, 'date'),
        entries,
      }),
    (r) =>
      `Appel enregistré pour ${r.saved} élèves` +
      (r.parentsNotified
        ? ` · ${r.parentsNotified} parent${r.parentsNotified > 1 ? 's' : ''} prévenu${r.parentsNotified > 1 ? 's' : ''}.`
        : '.'),
  );
}

/** Appel d'une classe pour un jour donné (aujourd'hui par défaut). */
export default function Attendance({
  loaderData: { classes, selected, date, lines },
}: Route.ComponentProps) {
  const result = useActionData<typeof action>();
  const [params, setParams] = useSearchParams();
  return (
    <>
      <PageHeader kicker="Enseignant" title="Appel" />
      {!selected ? (
        <NoClass />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <ClassPicker classes={classes} selected={selected} withSubject={false} />
            <label className="flex items-center gap-2 text-[13px] text-neutral-700">
              Jour
              <Input
                type="date"
                value={date}
                max={todayIso()}
                onChange={(event) => {
                  const next = new URLSearchParams(params);
                  next.set('date', event.target.value);
                  setParams(next);
                }}
                className="!w-auto"
              />
            </label>
          </div>
          {result &&
            (result.ok ? (
              <Notice>{result.message}</Notice>
            ) : (
              <Notice tone="error">{result.error}</Notice>
            ))}
          <AttendanceSheet key={`${selected.id}-${date}`} lines={lines} date={date} />
        </>
      )}
    </>
  );
}
