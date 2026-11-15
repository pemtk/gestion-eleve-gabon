import { useActionData } from 'react-router';
import { PageHeader } from '~/components/blocks';
import { FollowUpTable } from '~/components/teacher/FollowUpTable';
import type { FollowUpRow } from '~/components/teacher/types';
import { LinkButton, Notice, Tag } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import type { Route } from './+types/task-follow-up';

export async function loader({ request, params }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'enseignant');
  return api.get<{
    task: { id: string; title: string; due: string; className: string };
    rows: FollowUpRow[];
    doubts: number;
  }>(`/me/teacher/tasks/${encodeURIComponent(params.taskId)}/follow-up`);
}

export async function action({ request, params }: Route.ActionArgs) {
  const api = await spaceApi(request, 'enseignant');
  const fd = await request.formData();
  return run(
    () =>
      api.post(
        `/me/teacher/tasks/${encodeURIComponent(params.taskId)}/invalidate/${encodeURIComponent(str(fd, 'studentId'))}`,
      ),
    'Tâche invalidée : l’élève doit la refaire, ses points sont annulés.',
  );
}

/** Suivi d'une tâche : chaque élève de la classe, son temps, son auto-évaluation et sa preuve. */
export default function TaskFollowUp({ loaderData: { task, rows, doubts } }: Route.ComponentProps) {
  const result = useActionData<typeof action>();
  const done = rows.filter((r) => r.status === 'done').length;
  return (
    <>
      <PageHeader
        kicker={`Tâches › ${task.className}`}
        title={task.title}
        action={
          <LinkButton variant="secondary" to="/enseignant/taches" icon="arrow-left">
            Retour aux tâches
          </LinkButton>
        }
      />
      {result &&
        (result.ok ? (
          <Notice>{result.message}</Notice>
        ) : (
          <Notice tone="error">{result.error}</Notice>
        ))}
      <p className="flex flex-wrap items-center gap-3 text-[14px] text-neutral-700">
        <span>Échéance : {task.due}</span>
        <span>
          <span className="tnum">{done}</span> sur <span className="tnum">{rows.length}</span>{' '}
          terminées
        </span>
        {doubts > 0 && (
          <Tag tone="warn">
            {doubts} élève{doubts > 1 ? 's' : ''} avec des doutes
          </Tag>
        )}
      </p>
      <FollowUpTable rows={rows} />
    </>
  );
}
