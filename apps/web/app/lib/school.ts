import { useRouteLoaderData } from 'react-router';

/** Nom de l'établissement connecté (chargé une fois par la coque de l'espace école). */
export function useSchoolName(): string {
  const data = useRouteLoaderData('routes/ecole/layout') as { schoolName?: string } | undefined;
  return data?.schoolName ?? '';
}
