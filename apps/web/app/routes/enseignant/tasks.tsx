import { PageHeader } from '~/components/blocks';
import { TaskTable } from '~/components/teacher/TaskTable';
import type { TeacherTaskRow } from '~/components/teacher/types';
import { LinkButton } from '~/components/ui';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/tasks';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'enseignant');
  return { tasks: await api.get<TeacherTaskRow[]>('/me/teacher/tasks') };
}

/** Tâches publiées, de la plus récente à la plus ancienne. */
export default function Tasks({ loaderData: { tasks } }: Route.ComponentProps) {
  return (
    <>
      <PageHeader
        kicker="Enseignant"
        title="Tâches"
        action={
          <LinkButton to="/enseignant/taches/nouvelle" icon="plus">
            Nouvelle tâche
          </LinkButton>
        }
      />
      <TaskTable tasks={tasks} />
    </>
  );
}
