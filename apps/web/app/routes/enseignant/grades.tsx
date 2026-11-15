import { useState } from 'react';
import { useActionData } from 'react-router';
import { PageHeader } from '~/components/blocks';
import { ClassPicker } from '~/components/teacher/ClassPicker';
import { GradeSheet } from '~/components/teacher/GradeSheet';
import { NoClass } from '~/components/teacher/NoClass';
import type { ClassStudent } from '~/components/teacher/types';
import { Notice } from '~/components/ui';
import { run } from '~/lib/api.server';
import { str } from '~/lib/form';
import { classContext } from '~/lib/teacher.server';
import type { Route } from './+types/grades';

export async function loader({ request }: Route.LoaderArgs) {
  const { api, classes, selected } = await classContext(request);
  const students = selected
    ? await api.get<ClassStudent[]>(
        `/me/teacher/classes/${encodeURIComponent(selected.id)}/students`,
      )
    : [];
  return { classes, selected, students };
}

export async function action({ request }: Route.ActionArgs) {
  const { api, selected } = await classContext(request);
  const fd = await request.formData();
  if (!selected) return { ok: false as const, error: 'Choisissez une de vos classes.' };
  const entries = [...fd.keys()]
    .filter((key) => key.startsWith('grade-') && str(fd, key) !== '')
    .map((key) => {
      const studentId = key.slice('grade-'.length);
      return {
        studentId,
        value: Number(str(fd, key).replace(',', '.')),
        comment: str(fd, `comment-${studentId}`),
      };
    });
  if (entries.some((e) => Number.isNaN(e.value) || e.value < 0 || e.value > 20))
    return { ok: false as const, error: 'Chaque note doit être comprise entre 0 et 20.' };
  return run(
    () =>
      api.post<{ published: number; alreadyPublished: number }>('/me/teacher/grades', {
        classId: selected.id,
        subject: selected.subject,
        trimester: str(fd, 'trimester'),
        label: str(fd, 'label'),
        coefficient: Number(str(fd, 'coefficient').replace(',', '.')),
        entries,
      }),
    (r) =>
      `${r.published} note${r.published > 1 ? 's' : ''} publiée${r.published > 1 ? 's' : ''}` +
      (r.alreadyPublished
        ? ` · ${r.alreadyPublished} déjà publiée${r.alreadyPublished > 1 ? 's' : ''}, non modifiée${r.alreadyPublished > 1 ? 's' : ''}`
        : '') +
      ' : les élèves et les parents sont prévenus.',
  );
}

/** Saisie des notes d'une évaluation pour la classe choisie. */
export default function Grades({
  loaderData: { classes, selected, students },
}: Route.ComponentProps) {
  const result = useActionData<typeof action>();
  const [trimester, setTrimester] = useState('T1');
  return (
    <>
      <PageHeader kicker="Enseignant" title="Notes" />
      {!selected ? (
        <NoClass />
      ) : (
        <>
          <ClassPicker classes={classes} selected={selected} />
          {result &&
            (result.ok ? (
              <Notice>{result.message}</Notice>
            ) : (
              <Notice tone="error">{result.error}</Notice>
            ))}
          <GradeSheet
            key={selected.id + selected.subject}
            students={students}
            trimester={trimester}
            onTrimester={setTrimester}
          />
        </>
      )}
    </>
  );
}
