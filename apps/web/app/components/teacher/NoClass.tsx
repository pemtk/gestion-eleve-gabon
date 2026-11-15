import { Section } from '~/components/ui';

/** Affiché quand l'enseignant n'a encore aucune classe : c'est l'école qui l'affecte. */
export function NoClass() {
  return (
    <Section dashed>
      <p className="text-[15px]">Aucune classe ne vous est affectée pour l’instant.</p>
      <p className="mt-1 text-[13px] text-neutral-600">
        La direction de l’école doit vous affecter à une classe pour que vous puissiez publier des
        tâches, saisir des notes ou faire l’appel.
      </p>
    </Section>
  );
}
