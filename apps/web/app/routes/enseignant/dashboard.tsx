import { PageHeader } from '~/components/blocks';
import { Icon } from '~/components/icon';
import { ClassCard } from '~/components/teacher/ClassCard';
import { NoClass } from '~/components/teacher/NoClass';
import type { TeacherClass } from '~/components/teacher/types';
import { LinkButton, ProgressBar, Section, Tag } from '~/components/ui';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/dashboard';

interface Home {
  mainClass: TeacherClass | null;
  classes: TeacherClass[];
  currentTask: {
    id: string;
    title: string;
    className: string;
    due: string;
    done: number;
    total: number;
    doubts: number;
  } | null;
}

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'enseignant');
  return { user: api.user, home: await api.get<Home>('/me/teacher/home') };
}

/** Accueil de l'enseignant : ses classes, sa dernière tâche et les gestes du quotidien. */
export default function Dashboard({ loaderData: { user, home } }: Route.ComponentProps) {
  const task = home.currentTask;
  return (
    <>
      <PageHeader
        kicker={`Enseignant · ${user.organization ?? ''}`.replace(/ · $/, '')}
        title={`Bonjour ${user.name}`}
        action={
          <LinkButton to="/enseignant/taches/nouvelle" icon="plus">
            Nouvelle tâche
          </LinkButton>
        }
      />
      {!home.classes.length && <NoClass />}
      {task && (
        <Section title="Dernière tâche publiée" note={`${task.className} · ${task.due}`}>
          <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-2">
              <p className="text-[16px]">{task.title}</p>
              <ProgressBar
                value={task.total ? (task.done / task.total) * 100 : 0}
                label={`Élèves ayant terminé « ${task.title} »`}
              />
              <p className="text-[13px] text-neutral-600">
                <span className="tnum">{task.done}</span> sur{' '}
                <span className="tnum">{task.total}</span> élèves ont terminé
                {task.doubts > 0 && (
                  <>
                    {' · '}
                    <Tag tone="warn">
                      <Icon name="circle-help" size={12} className="mr-1" />
                      {task.doubts} doute{task.doubts > 1 ? 's' : ''}
                    </Tag>
                  </>
                )}
              </p>
            </div>
            <LinkButton variant="secondary" to={`/enseignant/taches/${task.id}`}>
              Voir le suivi
            </LinkButton>
          </div>
        </Section>
      )}
      {home.classes.length > 0 && (
        <section aria-labelledby="mes-classes" className="flex flex-col gap-3">
          <h2 id="mes-classes" className="text-[24px]">
            Mes classes
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {home.classes.map((item) => (
              <ClassCard key={`${item.id}|${item.subject}`} item={item} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
