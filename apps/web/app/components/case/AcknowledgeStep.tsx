import { Button, Section } from '~/components/ui';

/** Étape 1 : accuser réception, dans les 4 heures, pour que l'auteur sache que le dossier est pris en charge. */
export function AcknowledgeStep({ onAcknowledge }: { onAcknowledge: () => void }) {
  return (
    <Section title="Accuser réception">
      <p className="mb-3 text-[14px] text-neutral-700">
        L’auteur du signalement est informé que le dossier est pris en charge. Délai : 4 heures.
      </p>
      <Button icon="mail-check" onClick={onAcknowledge}>
        Accuser réception
      </Button>
    </Section>
  );
}
