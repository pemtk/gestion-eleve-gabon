import { selectedClass } from '~/components/teacher/class-selection';
import type { TeacherClass } from '~/components/teacher/types';
import { spaceApi } from './api.server';

/** Classes de l'enseignant et affectation choisie dans l'adresse (`?classe=`), pour les pages qui travaillent sur une classe. */
export async function classContext(request: Request) {
  const api = await spaceApi(request, 'enseignant');
  const classes = await api.get<TeacherClass[]>('/me/teacher/classes');
  const selected = selectedClass(classes, new URL(request.url).searchParams.get('classe'));
  return { api, classes, selected };
}
