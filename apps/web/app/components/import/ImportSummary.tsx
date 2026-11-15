import { Icon } from '~/components/icon';
import { Button, Section } from '~/components/ui';

interface Props {
  valid: number;
  errors: number;
  submitting: boolean;
  onConfirm: () => void;
}

/** Récapitulatif avant validation : combien de lignes partent, et ce qui va se passer pour elles. */
export function ImportSummary({ valid, errors, submitting, onConfirm }: Props) {
  return (
    <Section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Counter value={valid} label="lignes valides" highlighted />
        <Counter value={errors} label="à corriger" />
      </div>
      <div className="text-[11px] tracking-[.1em] text-accent-700 uppercase">
        Ce qui va se passer
      </div>
      <ul className="flex flex-col gap-2.5 text-[13.5px]">
        <Consequence icon="user-plus">
          {valid} comptes élèves créés et rattachés à leur classe.
        </Consequence>
        <Consequence icon="message-square">
          Un SMS d’activation est envoyé à chaque numéro.
        </Consequence>
        <Consequence icon="circle-alert">
          {errors
            ? `${errors} lignes en erreur ne seront pas importées tant qu’elles ne sont pas corrigées.`
            : 'Aucune ligne en erreur.'}
        </Consequence>
      </ul>
      <Button icon="check" disabled={!valid || submitting} onClick={onConfirm}>
        Importer {valid} élèves
      </Button>
    </Section>
  );
}

function Counter({
  value,
  label,
  highlighted,
}: {
  value: number;
  label: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={
        highlighted
          ? 'rounded-lg border border-accent-300 bg-accent-100 p-3'
          : 'rounded-lg border border-divider p-3'
      }
    >
      <div
        className={`tnum font-heading text-[34px] leading-none ${highlighted ? 'text-accent-800' : ''}`}
      >
        {value}
      </div>
      <div className={`text-[12px] ${highlighted ? 'text-accent-800' : 'text-neutral-700'}`}>
        {label}
      </div>
    </div>
  );
}

function Consequence({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Icon name={icon} size={16} className="mt-0.5 flex-none text-accent-700" />
      {children}
    </li>
  );
}
