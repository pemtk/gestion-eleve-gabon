import { Link } from 'react-router';
import { EmptyState } from '~/components/blocks';
import { ProgressBar, Section } from '~/components/ui';
import type { TeacherTaskRow } from './types';

/** Tâches publiées par l'enseignant : échéance et avancement de la classe, avec le lien vers le suivi élève par élève. */
export function TaskTable({ tasks }: { tasks: TeacherTaskRow[] }) {
  if (!tasks.length)
    return (
      <EmptyState
        icon="list-checks"
        title="Aucune tâche publiée"
        text="Publiez un exercice, un cours ou un devoir : les élèves et leurs parents sont prévenus."
      />
    );
  return (
    <Section className="overflow-x-auto !p-0">
      <table className="w-full min-w-[600px] text-[14px]">
        <thead>
          <tr className="border-b border-divider text-left text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            <th className="px-5 py-2.5 font-normal">Tâche</th>
            <th className="px-3 py-2.5 font-normal">Classe</th>
            <th className="px-3 py-2.5 font-normal">Échéance</th>
            <th className="w-48 px-3 py-2.5 font-normal">Terminée par</th>
            <th className="px-5 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-divider last:border-0">
              <td className="px-5 py-3">{task.title}</td>
              <td className="px-3 py-3 text-neutral-700">{task.className}</td>
              <td className="px-3 py-3 text-neutral-700">{task.due}</td>
              <td className="px-3 py-3">
                <div className="flex flex-col gap-1">
                  <ProgressBar
                    value={task.total ? (task.done / task.total) * 100 : 0}
                    label={`Avancement de « ${task.title} »`}
                  />
                  <span className="tnum text-[12px] text-neutral-600">
                    {task.done} / {task.total} élèves
                  </span>
                </div>
              </td>
              <td className="px-5 py-3 text-right">
                <Link to={`/enseignant/taches/${task.id}`} className="font-semibold">
                  Suivi
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
