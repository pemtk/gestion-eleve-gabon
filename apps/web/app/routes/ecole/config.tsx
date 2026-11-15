import { PageHeader } from '~/components/blocks';
import { ActionNotice, Tabs } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { flag, str } from '~/lib/form';
import type { ClassRow, TeacherRow } from '~/lib/types';
import { useSchoolName } from '~/lib/school';
import type { Route } from './+types/config';
import type { Assignment, Year } from '../../components/config/types';
import { YearForm } from '../../components/config/YearForm';
import { ClassesTab } from '../../components/config/ClassesTab';
import { AssignmentsTab } from '../../components/config/AssignmentsTab';
import { PhotosTab } from '../../components/config/PhotosTab';

const TABS = ['annees', 'classes', 'affect', 'photos'] as const;

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  const t = new URL(request.url).searchParams.get('tab');
  const [year, classes, assignments, teachers, photos] = await Promise.all([
    api.get<Year>('/school/year'),
    api.get<ClassRow[]>('/school/classes'),
    api.get<Assignment[]>('/school/assignments'),
    api.get<TeacherRow[]>('/school/teachers'),
    api.get<{ proofVisibleToParents: boolean }>('/school/photo-settings'),
  ]);
  return {
    tab: TABS.find((x) => x === t) ?? 'annees',
    year,
    classes,
    assignments,
    teachers,
    photos,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  switch (str(fd, 'intent')) {
    case 'saveYear':
    case 'activateYear': {
      const terms = [0, 1, 2].map((i) => ({
        name: str(fd, `t${i}-name`),
        start: str(fd, `t${i}-start`),
        end: str(fd, `t${i}-end`),
        coefficient: Number(str(fd, `t${i}-coef`).replace(',', '.')) || 1,
      }));
      const body = { label: str(fd, 'label'), start: str(fd, 'start'), end: str(fd, 'end'), terms };
      const activate = str(fd, 'intent') === 'activateYear';
      return run(
        async () => {
          await api.put('/school/year', body);
          if (activate) await api.post('/school/year/activate');
        },
        activate
          ? 'Année scolaire activée : elle est maintenant visible de tous.'
          : 'Année enregistrée en brouillon.',
      );
    }
    case 'class':
      return run(
        () =>
          api.post('/school/classes', {
            level: str(fd, 'level'),
            name: str(fd, 'name'),
            capacity: Number(str(fd, 'capacity')),
          }),
        'Classe créée.',
      );
    case 'photos':
      return run(
        () =>
          api.put('/school/photo-settings', {
            proofVisibleToParents: flag(fd, 'proofVisibleToParents'),
          }),
        'Réglage des photos enregistré.',
      );
    case 'assign':
      return run(
        () =>
          api.post('/school/assignments', {
            teacherId: str(fd, 'teacherId'),
            classId: str(fd, 'classId'),
            subject: str(fd, 'subject'),
            year: str(fd, 'year'),
            principal: flag(fd, 'principal'),
          }),
        'Affectation enregistrée.',
      );
  }
  return null;
}

export default function Config({ loaderData: d, actionData }: Route.ComponentProps) {
  const school = useSchoolName();
  const link = (tab: string) => `/ecole/configuration?tab=${tab}`;
  return (
    <>
      <PageHeader kicker={`Configuration · ${school}`} title="Année, classes et affectations" />
      <Tabs
        items={[
          { to: link('annees'), label: 'Années scolaires', active: d.tab === 'annees' },
          {
            to: link('classes'),
            label: 'Classes',
            badge: String(d.classes.length),
            active: d.tab === 'classes',
          },
          { to: link('affect'), label: 'Affectations enseignants', active: d.tab === 'affect' },
          { to: link('photos'), label: 'Photos', active: d.tab === 'photos' },
        ]}
      />
      <ActionNotice result={actionData ?? undefined} />
      {d.tab === 'annees' && <YearForm year={d.year} />}
      {d.tab === 'classes' && <ClassesTab classes={d.classes} />}
      {d.tab === 'affect' && (
        <AssignmentsTab
          year={d.year}
          classes={d.classes}
          teachers={d.teachers}
          assignments={d.assignments}
        />
      )}
      {d.tab === 'photos' && <PhotosTab proofVisibleToParents={d.photos.proofVisibleToParents} />}
    </>
  );
}
