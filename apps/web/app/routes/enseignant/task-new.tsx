import { redirect, useActionData } from 'react-router';
import { PageHeader } from '~/components/blocks';
import { classKey } from '~/components/teacher/class-selection';
import { NoClass } from '~/components/teacher/NoClass';
import { TaskForm } from '~/components/teacher/TaskForm';
import { LinkButton, Notice } from '~/components/ui';
import { ApiError } from '~/lib/api.server';
import { flag, str } from '~/lib/form';
import { classContext } from '~/lib/teacher.server';
import type { Route } from './+types/task-new';

export async function loader({ request }: Route.LoaderArgs) {
  const { classes, selected } = await classContext(request);
  return { classes, initialClass: selected ? classKey(selected) : '' };
}

export async function action({ request }: Route.ActionArgs) {
  const { api, classes } = await classContext(request);
  const fd = await request.formData();
  const [classId, subject] = str(fd, 'classe').split('|');
  const target = classes.find((c) => c.id === classId && c.subject === subject);
  if (!target) return { error: 'Choisissez une de vos classes.' };
  const estimate = parseInt(str(fd, 'estimate'), 10);
  try {
    await api.post('/me/teacher/tasks', {
      classId: target.id,
      subject: target.subject,
      type: str(fd, 'type'),
      title: str(fd, 'title'),
      description: str(fd, 'description'),
      due: str(fd, 'due'),
      estimateMinutes: estimate > 0 ? estimate : undefined,
      requirePhoto: flag(fd, 'requirePhoto'),
      graded: flag(fd, 'graded'),
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  return redirect('/enseignant/taches');
}

/** Publier une tâche (exercice, cours ou devoir) pour une de mes classes. */
export default function NewTask({ loaderData: { classes, initialClass } }: Route.ComponentProps) {
  const result = useActionData<typeof action>();
  return (
    <>
      <PageHeader
        kicker="Enseignant › Tâches"
        title="Nouvelle tâche"
        action={
          <LinkButton variant="secondary" to="/enseignant/taches" icon="arrow-left">
            Retour aux tâches
          </LinkButton>
        }
      />
      {result?.error && <Notice tone="error">{result.error}</Notice>}
      {classes.length ? <TaskForm classes={classes} initialClass={initialClass} /> : <NoClass />}
    </>
  );
}
