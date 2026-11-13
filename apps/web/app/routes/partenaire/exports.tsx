import { Icon } from '~/components/icon';
import { PageHeader } from '~/components/blocks';
import { Section } from '~/components/ui';

export default function Exports() {
  return (
    <>
      <PageHeader kicker="Données agrégées et anonymisées" title="Exports" />
      <Section title="Signalements par type et statut" note="CSV · cellules de moins de 10 masquées">
        <p className="mb-4 max-w-prose text-[14px] text-neutral-700">Le fichier ne contient que des effectifs agrégés. Les cellules masquées restent vides.</p>
        <a href="/partenaire/export.csv" download className="inline-flex min-h-10 items-center gap-2 rounded-md border-[1.5px] border-accent bg-accent-100 px-4 font-heading font-semibold text-accent-800 no-underline hover:bg-accent-200 hover:text-accent-800">
          <Icon name="download" size={16} />Télécharger le CSV
        </a>
      </Section>
      <Section title="Indicateurs par province" note="CSV · cellules de moins de 10 masquées">
        <p className="mb-4 max-w-prose text-[14px] text-neutral-700">Activation, complétion des tâches, présence (30 jours) et signalements par province. Les chiffres sont ceux de l’écran « Par région » ; une cellule masquée reste vide.</p>
        <a href="/partenaire/export.csv?dataset=provinces" download className="inline-flex min-h-10 items-center gap-2 rounded-md border-[1.5px] border-accent bg-accent-100 px-4 font-heading font-semibold text-accent-800 no-underline hover:bg-accent-200 hover:text-accent-800">
          <Icon name="download" size={16} />Télécharger le CSV
        </a>
      </Section>
    </>
  );
}
