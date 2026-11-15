import type { CsvStudentRow } from '@sge/shared';
import { Icon } from '~/components/icon';
import { Button, Input, Section, Tag, cx } from '~/components/ui';

const COLUMNS = 'grid-cols-[.45fr_1fr_1fr_1.5fr_.9fr_2.2fr]';
const EDITABLE = ['nom', 'prenom', 'phone', 'classe'] as const;
const PAGE_SIZE = 50;

interface Props {
  rows: CsvStudentRow[];
  errors: number;
  onlyErrors: boolean;
  onOnlyErrorsChange: (onlyErrors: boolean) => void;
  fixing: number | null;
  onFixing: (line: number | null) => void;
  onFix: (line: number, patch: Partial<CsvStudentRow>) => void;
}

/** Tableau de vérification : une ligne par élève, avec son statut et la correction sur place. */
export function ReviewTable({
  rows,
  errors,
  onlyErrors,
  onOnlyErrorsChange,
  fixing,
  onFixing,
  onFix,
}: Props) {
  return (
    <Section className="overflow-x-auto !p-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-[21px]">Vérification des lignes</h2>
        <div className="flex gap-1.5">
          <FilterButton active={onlyErrors} onClick={() => onOnlyErrorsChange(true)}>
            À corriger ({errors})
          </FilterButton>
          <FilterButton active={!onlyErrors} onClick={() => onOnlyErrorsChange(false)}>
            Toutes
          </FilterButton>
        </div>
      </div>
      <div className="min-w-[760px]">
        <div
          className={cx(
            'grid border-y border-divider px-2 text-[11px] tracking-[.08em] text-neutral-700 uppercase',
            COLUMNS,
          )}
        >
          {['Ligne', 'Nom', 'Prénom', 'Téléphone', 'Classe', 'Statut'].map((heading) => (
            <div key={heading} className="px-2 py-2">
              {heading}
            </div>
          ))}
        </div>
        {rows.slice(0, PAGE_SIZE).map((row) => (
          <div
            key={row.line}
            className={cx(
              'grid items-center border-b border-divider px-2 py-2 text-[13.5px]',
              COLUMNS,
              row.error && 'bg-accent-100/60',
            )}
          >
            <div className="tnum px-2 text-neutral-600">{row.line}</div>
            {fixing === row.line ? (
              <EditableRow row={row} onFix={onFix} onDone={() => onFixing(null)} />
            ) : (
              <ReadOnlyRow row={row} onEdit={() => onFixing(row.line)} />
            )}
          </div>
        ))}
        {rows.length > PAGE_SIZE && (
          <div className="px-5 py-3 text-[12.5px] text-neutral-600">
            … et {rows.length - PAGE_SIZE} autres lignes
          </div>
        )}
        {!rows.length && (
          <div className="px-5 py-8 text-center italic text-neutral-600">
            Toutes les lignes sont valides.
          </div>
        )}
      </div>
    </Section>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'min-h-8 rounded-md border px-3 text-[12.5px]',
        active ? 'border-accent bg-accent-100 text-accent-800' : 'border-divider',
      )}
    >
      {children}
    </button>
  );
}

function EditableRow({
  row,
  onFix,
  onDone,
}: {
  row: CsvStudentRow;
  onFix: Props['onFix'];
  onDone: () => void;
}) {
  return (
    <>
      {EDITABLE.map((field) => (
        <div key={field} className="px-1">
          <Input
            aria-label={field}
            value={row[field]}
            onChange={(event) => onFix(row.line, { [field]: event.target.value })}
            className="!min-h-8 !px-2 !text-[13px]"
          />
        </div>
      ))}
      <div className="px-2">
        <Button variant="ghost" onClick={onDone}>
          OK
        </Button>
      </div>
    </>
  );
}

function ReadOnlyRow({ row, onEdit }: { row: CsvStudentRow; onEdit: () => void }) {
  return (
    <>
      <div className="px-2">{row.nom || '—'}</div>
      <div className="px-2">{row.prenom || '—'}</div>
      <div className="tnum px-2 whitespace-nowrap">{row.phone}</div>
      <div className="px-2">{row.classe}</div>
      <div className="flex items-center gap-2 px-2">
        {row.error ? (
          <>
            <Tag tone="warn" className="whitespace-nowrap">
              <Icon name="circle-alert" size={12} className="mr-1" />
              {row.error}
            </Tag>
            <Button variant="ghost" onClick={onEdit}>
              Corriger
            </Button>
          </>
        ) : (
          <Tag tone="hi" className="whitespace-nowrap">
            <Icon name="check" size={12} className="mr-1" />
            Valide
          </Tag>
        )}
      </div>
    </>
  );
}
