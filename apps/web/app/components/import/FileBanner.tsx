import { Icon } from '~/components/icon';
import { Button } from '~/components/ui';

/** Rappel du fichier en cours de vérification, avec la possibilité d'en choisir un autre. */
export function FileBanner({
  name,
  lines,
  onChange,
}: {
  name: string;
  lines: number;
  onChange: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-divider px-4 py-3">
      <Icon name="file-spreadsheet" size={22} className="text-accent-700" />
      <div className="flex-1 text-[14px]">
        {name}
        <div className="text-[12px] text-neutral-600">{lines} lignes lues</div>
      </div>
      <Button variant="ghost" onClick={onChange}>
        Changer de fichier
      </Button>
    </div>
  );
}
