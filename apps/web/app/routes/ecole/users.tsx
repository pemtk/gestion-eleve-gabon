import { PageHeader } from '~/components/blocks';
import { ActionNotice, LinkButton, Tabs } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import type {
  ClassRow,
  LinkRequestRow,
  StudentRow,
  SubscriptionInfo,
  TeacherRow,
} from '~/lib/types';
import { useSchoolName } from '~/lib/school';
import type { Route } from './+types/users';
import { StudentsTab } from '../../components/users/StudentsTab';
import { TeachersTab } from '../../components/users/TeachersTab';
import { LinkRequestsTab } from '../../components/users/LinkRequestsTab';

const TABS = ['eleves', 'profs', 'ratt'] as const;

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  const url = new URL(request.url);
  const t = url.searchParams.get('tab');
  const tab = TABS.find((x) => x === t) ?? 'eleves';
  const [students, teachers, requests, classes, sub] = await Promise.all([
    api.get<StudentRow[]>('/school/students'),
    api.get<TeacherRow[]>('/school/teachers'),
    api.get<LinkRequestRow[]>('/school/link-requests'),
    api.get<ClassRow[]>('/school/classes'),
    api.get<SubscriptionInfo>('/school/subscription'),
  ]);
  const selected = students.find((s) => s.id === url.searchParams.get('eleve')) ?? students[0];
  return {
    tab,
    students,
    teachers,
    requests,
    classes,
    sms: sub.features.sms,
    selected,
    pending: requests.filter((r) => !r.decision).length,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  switch (str(fd, 'intent')) {
    case 'student':
      return run(
        () =>
          api.post<{ smsSent: boolean }>('/school/students', {
            lastName: str(fd, 'lastName'),
            firstName: str(fd, 'firstName'),
            phone: str(fd, 'phone'),
            classId: str(fd, 'classId'),
          }),
        (r) =>
          r.smsSent
            ? 'Élève créé. SMS d’activation envoyé ; code parent généré.'
            : 'Élève créé. Codes d’activation et parent à imprimer (relais SMS : formule Standard).',
      );
    case 'regenerate':
      return run(
        () => api.post(`/school/students/${str(fd, 'id')}/regenerate-code`),
        'Nouveau code généré. L’ancien est désactivé.',
      );
    case 'sendCode':
      return run(
        () => api.post(`/school/students/${str(fd, 'id')}/send-code`),
        'Code envoyé par SMS au numéro parent enregistré.',
      );
    case 'invite':
      return run(
        () =>
          api.post('/school/teachers/invite', { name: str(fd, 'name'), phone: str(fd, 'phone') }),
        'Invitation envoyée par SMS. Affectez l’enseignant dès qu’il a activé son compte.',
      );
    case 'resend':
      return run(
        () => api.post(`/school/teachers/${str(fd, 'id')}/resend`),
        'Invitation renvoyée.',
      );
    case 'accept':
    case 'refuse':
      return run(
        () => api.post(`/school/link-requests/${str(fd, 'id')}/${str(fd, 'intent')}`),
        str(fd, 'intent') === 'accept'
          ? 'Rattachement validé. Le parent est prévenu.'
          : 'Demande refusée.',
      );
  }
  return null;
}

export default function Users({ loaderData: d, actionData }: Route.ComponentProps) {
  const school = useSchoolName();
  const link = (tab: string) => `/ecole/utilisateurs?tab=${tab}`;
  return (
    <>
      <PageHeader
        kicker={`Utilisateurs · ${school}`}
        title="Élèves, enseignants et parents"
        action={
          <LinkButton to="/ecole/utilisateurs/import" icon="upload">
            Importer des élèves
          </LinkButton>
        }
      />
      <Tabs
        items={[
          {
            to: link('eleves'),
            label: 'Élèves',
            badge: String(d.students.length),
            active: d.tab === 'eleves',
          },
          {
            to: link('profs'),
            label: 'Enseignants',
            badge: String(d.teachers.length),
            active: d.tab === 'profs',
          },
          {
            to: link('ratt'),
            label: 'Rattachements à valider',
            badge: String(d.pending),
            active: d.tab === 'ratt',
          },
        ]}
      />
      <ActionNotice result={actionData ?? undefined} />
      {d.tab === 'eleves' && <StudentsTab d={d} />}
      {d.tab === 'profs' && <TeachersTab d={d} />}
      {d.tab === 'ratt' && <LinkRequestsTab d={d} />}
    </>
  );
}
