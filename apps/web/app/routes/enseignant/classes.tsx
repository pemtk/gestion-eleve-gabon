import { PageHeader } from '~/components/blocks';
import { ClassPicker } from '~/components/teacher/ClassPicker';
import { NoClass } from '~/components/teacher/NoClass';
import { ParentCodesTable } from '~/components/teacher/ParentCodesTable';
import type { ParentCodeRow } from '~/components/teacher/types';
import { classContext } from '~/lib/teacher.server';
import type { Route } from './+types/classes';

export async function loader({ request }: Route.LoaderArgs) {
  const { api, classes, selected } = await classContext(request);
  const rows = selected
    ? await api.get<ParentCodeRow[]>(
        `/me/teacher/parent-codes?classId=${encodeURIComponent(selected.id)}`,
      )
    : [];
  return { classes, selected, rows };
}

/** Mes classes : la liste des élèves de la classe choisie et leurs codes d'invitation parent. */
export default function Classes({ loaderData: { classes, selected, rows } }: Route.ComponentProps) {
  return (
    <>
      <PageHeader kicker="Enseignant" title="Mes classes" />
      {!selected ? (
        <NoClass />
      ) : (
        <>
          <ClassPicker classes={classes} selected={selected} />
          <ParentCodesTable rows={rows} className={selected.name} />
        </>
      )}
    </>
  );
}
