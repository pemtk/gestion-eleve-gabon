import { useRef } from 'react';
import { Icon } from '~/components/icon';
import { Button, Section } from '~/components/ui';

const COLUMNS: [name: string, required: boolean][] = [
  ['nom', true],
  ['prénom', true],
  ['téléphone', true],
  ['classe', true],
  ['sexe', false],
  ['date de naissance', false],
];

interface Props {
  onFile: (file?: File) => void;
  onSample: () => void;
}

/** Étape « Fichier » : zone de dépôt du CSV et rappel des colonnes attendues. */
export function UploadStep({ onFile, onSample }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onFile(event.dataTransfer.files[0]);
        }}
        className="flex min-h-[340px] flex-col items-center justify-center gap-3 rounded-lg border-[1.5px] border-dashed border-accent-400 p-8 text-center"
      >
        <div className="grid h-[72px] w-[72px] place-items-center rounded-full border-[1.5px] border-accent text-accent-700 shadow-[0_0_0_8px_var(--color-accent-100)]">
          <Icon name="upload" size={30} />
        </div>
        <div className="mt-2 font-heading text-[28px] leading-tight">
          Déposez votre fichier CSV ici
        </div>
        <div className="text-[14px] text-neutral-700">ou</div>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label="Fichier CSV"
          onChange={(event) => onFile(event.target.files?.[0])}
        />
        <Button
          icon="folder-open"
          className="!min-h-11 px-5 text-[17px]"
          onClick={() => input.current?.click()}
        >
          Choisir un fichier
        </Button>
        <Button variant="ghost" onClick={onSample}>
          Essayer avec un fichier d’exemple
        </Button>
        <div className="text-[12.5px] text-neutral-600">Fichier .csv · 2 000 lignes au maximum</div>
      </div>
      <Section>
        <div className="text-[11px] tracking-[.1em] text-accent-700 uppercase">
          Étape 1 · le modèle
        </div>
        <h2 className="mt-1 mb-3 text-[22px]">Colonnes attendues</h2>
        {COLUMNS.map(([name, required]) => (
          <div key={name} className="flex justify-between border-t border-divider py-2 text-[14px]">
            <span>{name}</span>
            <span className={required ? 'text-accent-800' : 'text-neutral-600'}>
              {required ? 'obligatoire' : 'facultatif'}
            </span>
          </div>
        ))}
      </Section>
    </div>
  );
}
