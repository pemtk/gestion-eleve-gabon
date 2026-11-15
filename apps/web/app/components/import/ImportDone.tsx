import { Icon } from '~/components/icon';
import { Button, LinkButton, Section } from '~/components/ui';

/** Écran de fin d'import : combien d'élèves ont été créés, et que faire ensuite. */
export function ImportDone({ count, onRestart }: { count: number; onRestart: () => void }) {
  return (
    <Section className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full border-[1.5px] border-accent bg-accent-100 text-accent-800">
        <Icon name="check" size={28} />
      </div>
      <h2 className="text-[34px] font-normal">{count} élèves importés</h2>
      <p className="max-w-md text-[14px] text-neutral-700">
        Les comptes sont créés. Les SMS d’activation partent par lots ; vous pouvez fermer cette
        page.
      </p>
      <div className="flex gap-2">
        <LinkButton variant="secondary" to="/ecole">
          Retour au tableau de bord
        </LinkButton>
        <Button onClick={onRestart}>Nouvel import</Button>
      </div>
    </Section>
  );
}
