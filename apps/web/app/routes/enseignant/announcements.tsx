import { useActionData } from 'react-router';
import { PageHeader } from '~/components/blocks';
import { AnnouncementForm } from '~/components/teacher/AnnouncementForm';
import { ClassPicker } from '~/components/teacher/ClassPicker';
import { NoClass } from '~/components/teacher/NoClass';
import { Notice } from '~/components/ui';
import { run } from '~/lib/api.server';
import { str } from '~/lib/form';
import { classContext } from '~/lib/teacher.server';
import type { Route } from './+types/announcements';

export async function loader({ request }: Route.LoaderArgs) {
  const { api, classes, selected } = await classContext(request);
  return {
    classes,
    selected,
    templates: await api.get<Record<string, string>>('/me/teacher/announcement-templates'),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { api, selected } = await classContext(request);
  const fd = await request.formData();
  if (!selected) return { ok: false as const, error: 'Choisissez une de vos classes.' };
  return run(
    () =>
      api.post<{ recipients: { students: number; parents: number } }>('/me/teacher/announcements', {
        classId: selected.id,
        message: str(fd, 'message'),
      }),
    (r) => `Annonce envoyée à ${r.recipients.students} élèves et ${r.recipients.parents} parents.`,
  );
}

/** Annonce à une de mes classes. */
export default function Announcements({
  loaderData: { classes, selected, templates },
}: Route.ComponentProps) {
  const result = useActionData<typeof action>();
  return (
    <>
      <PageHeader kicker="Enseignant" title="Annonces" />
      {!selected ? (
        <NoClass />
      ) : (
        <>
          <ClassPicker classes={classes} selected={selected} withSubject={false} />
          {result &&
            (result.ok ? (
              <Notice>{result.message}</Notice>
            ) : (
              <Notice tone="error">{result.error}</Notice>
            ))}
          <AnnouncementForm
            key={selected.id}
            templates={templates}
            className={selected.name}
            students={selected.students}
          />
        </>
      )}
    </>
  );
}
