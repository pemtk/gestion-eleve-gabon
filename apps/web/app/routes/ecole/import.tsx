import { useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { IMPORT_PREVIEW, STUDENT_CSV_HEADER, buildStudentCsv, parseStudentCsv, validateStudentRow, type CsvStudentRow } from '@sge/shared';
import { Icon } from '~/components/icon';
import { PageHeader } from '~/components/blocks';
import { Button, Input, Notice, Section, Tag, cx } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import type { ClassRow } from '~/lib/types';
import type { Route } from './+types/import';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  return { classNames: (await api.get<ClassRow[]>('/school/classes')).map((c) => c.name) };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  return run(() => api.post<{ imported: number }>('/school/students/import/confirm', { csv: str(fd, 'csv') }), 'Import terminé.');
}

const STEPS = ['Modèle', 'Fichier', 'Vérification', 'Validation'];
const COLUMNS: [string, boolean][] = [['nom', true], ['prénom', true], ['téléphone', true], ['classe', true], ['sexe', false], ['date de naissance', false]];

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportStudents({ loaderData: { classNames } }: Route.ComponentProps) {
  const [step, setStep] = useState<2 | 3 | 4>(2);
  const [file, setFile] = useState('');
  const [rows, setRows] = useState<CsvStudentRow[]>([]);
  const [onlyErr, setOnlyErr] = useState(true);
  const [fixing, setFixing] = useState<number | null>(null);
  const [problem, setProblem] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const f = useFetcher<{ ok: boolean; error?: string }>();

  const errors = rows.filter((r) => r.error).length;
  const valid = rows.length - errors;
  const shown = onlyErr ? rows.filter((r) => r.error || r.line === fixing) : rows;

  const load = (name: string, text: string) => {
    const parsed = parseStudentCsv(text, classNames);
    if (parsed.missingColumns.length) return setProblem(`Colonnes manquantes : ${parsed.missingColumns.join(', ')}. Téléchargez le modèle.`);
    if (!parsed.rows.length) return setProblem('Le fichier ne contient aucune ligne.');
    if (parsed.rows.length > 2000) return setProblem('2 000 lignes au maximum par fichier.');
    setProblem(''); setFile(name); setRows(parsed.rows); setOnlyErr(parsed.rows.some((r) => r.error)); setStep(3);
  };
  const pick = async (fl?: File) => fl && load(fl.name, await fl.text());
  const sample = () => load('exemple_eleves.csv', buildStudentCsv(IMPORT_PREVIEW.map((r) => ({ nom: r.nom, prenom: r.prenom, phone: r.phone, classe: r.classe === 'Seconde A' ? classNames[0] ?? r.classe : r.classe }))));

  const fix = (line: number, patch: Partial<CsvStudentRow>) =>
    setRows((rs) => rs.map((r) => {
      if (r.line !== line) return r;
      const next = { ...r, ...patch, error: undefined };
      const error = validateStudentRow(next, classNames);
      return error ? { ...next, error } : next;
    }));

  const confirm = () => f.submit({ csv: buildStudentCsv(rows.filter((r) => !r.error)) }, { method: 'post' });
  const done = f.data?.ok === true;

  return (
    <>
      <PageHeader kicker="Utilisateurs › Élèves" title="Importer des élèves"
        action={<Button variant="secondary" icon="download" onClick={() => download('modele_import_eleves.csv', `${STUDENT_CSV_HEADER}\nMboumba,Ruth,+241 07 55 12 90,${classNames[0] ?? '3ème B'}`)}>Télécharger le modèle</Button>} />

      <ol className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Étapes de l’import">
        {STEPS.map((label, i) => {
          const n = i + 1; const cur = done ? 4 : step; const complete = done ? true : n < cur; const current = !done && n === cur;
          return (
            <li key={label} aria-current={current ? 'step' : undefined} className={cx('flex items-center gap-2.5 border-t-2 pt-3', complete || current ? 'border-accent' : 'border-divider')}>
              <span className={cx('grid h-7 w-7 flex-none place-items-center rounded-full border-[1.5px] font-heading text-[15px] font-semibold text-accent-800', complete ? 'border-accent bg-accent-100' : current ? 'border-accent' : 'border-divider')}>
                {complete ? <Icon name="check" size={14} /> : n}
              </span>
              <span className={cx('text-[14px]', current ? 'text-accent-800' : complete ? '' : 'text-neutral-600')}>{label}</span>
            </li>
          );
        })}
      </ol>

      {problem && <Notice tone="error">{problem}</Notice>}
      {f.data && !f.data.ok && <Notice tone="error">{f.data.error}</Notice>}

      {step === 2 && !done && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]); }}
            className="flex min-h-[340px] flex-col items-center justify-center gap-3 rounded-lg border-[1.5px] border-dashed border-accent-400 p-8 text-center">
            <div className="grid h-[72px] w-[72px] place-items-center rounded-full border-[1.5px] border-accent text-accent-700 shadow-[0_0_0_8px_var(--color-accent-100)]"><Icon name="upload" size={30} /></div>
            <div className="mt-2 font-heading text-[28px] leading-tight">Déposez votre fichier CSV ici</div>
            <div className="text-[14px] text-neutral-700">ou</div>
            <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Fichier CSV" onChange={(e) => void pick(e.target.files?.[0])} />
            <Button icon="folder-open" className="!min-h-11 px-5 text-[17px]" onClick={() => input.current?.click()}>Choisir un fichier</Button>
            <Button variant="ghost" onClick={sample}>Essayer avec un fichier d’exemple</Button>
            <div className="text-[12.5px] text-neutral-600">Fichier .csv · 2 000 lignes au maximum</div>
          </div>
          <Section>
            <div className="text-[11px] tracking-[.1em] text-accent-700 uppercase">Étape 1 · le modèle</div>
            <h2 className="mt-1 mb-3 text-[22px]">Colonnes attendues</h2>
            {COLUMNS.map(([k, req]) => <div key={k} className="flex justify-between border-t border-divider py-2 text-[14px]"><span>{k}</span><span className={req ? 'text-accent-800' : 'text-neutral-600'}>{req ? 'obligatoire' : 'facultatif'}</span></div>)}
          </Section>
        </div>
      )}

      {step === 3 && !done && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-divider px-4 py-3">
            <Icon name="file-spreadsheet" size={22} className="text-accent-700" />
            <div className="flex-1 text-[14px]">{file}<div className="text-[12px] text-neutral-600">{rows.length} lignes lues</div></div>
            <Button variant="ghost" onClick={() => { setStep(2); setRows([]); }}>Changer de fichier</Button>
          </div>
          <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <Section className="overflow-x-auto !p-0">
              <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <h2 className="text-[21px]">Vérification des lignes</h2>
                <div className="flex gap-1.5">
                  {[[true, `À corriger (${errors})`], [false, 'Toutes']].map(([v, l]) => (
                    <button key={String(l)} type="button" aria-pressed={onlyErr === v} onClick={() => setOnlyErr(v as boolean)} className={cx('min-h-8 rounded-md border px-3 text-[12.5px]', onlyErr === v ? 'border-accent bg-accent-100 text-accent-800' : 'border-divider')}>{l as string}</button>
                  ))}
                </div>
              </div>
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[.45fr_1fr_1fr_1.5fr_.9fr_2.2fr] border-y border-divider px-2 text-[11px] tracking-[.08em] text-neutral-700 uppercase">
                  {['Ligne', 'Nom', 'Prénom', 'Téléphone', 'Classe', 'Statut'].map((h) => <div key={h} className="px-2 py-2">{h}</div>)}
                </div>
                {shown.slice(0, 50).map((r) => (
                  <div key={r.line} className={cx('grid grid-cols-[.45fr_1fr_1fr_1.5fr_.9fr_2.2fr] items-center border-b border-divider px-2 py-2 text-[13.5px]', r.error && 'bg-accent-100/60')}>
                    <div className="tnum px-2 text-neutral-600">{r.line}</div>
                    {fixing === r.line ? (
                      <>
                        {(['nom', 'prenom', 'phone', 'classe'] as const).map((k) => (
                          <div key={k} className="px-1"><Input aria-label={k} value={r[k]} onChange={(e) => fix(r.line, { [k]: e.target.value })} className="!min-h-8 !px-2 !text-[13px]" /></div>
                        ))}
                        <div className="px-2"><Button variant="ghost" onClick={() => setFixing(null)}>OK</Button></div>
                      </>
                    ) : (
                      <>
                        <div className="px-2">{r.nom || '—'}</div><div className="px-2">{r.prenom || '—'}</div><div className="tnum px-2 whitespace-nowrap">{r.phone}</div><div className="px-2">{r.classe}</div>
                        <div className="flex items-center gap-2 px-2">
                          {r.error ? <><Tag tone="warn" className="whitespace-nowrap"><Icon name="circle-alert" size={12} className="mr-1" />{r.error}</Tag><Button variant="ghost" onClick={() => setFixing(r.line)}>Corriger</Button></> : <Tag tone="hi" className="whitespace-nowrap"><Icon name="check" size={12} className="mr-1" />Valide</Tag>}
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {shown.length > 50 && <div className="px-5 py-3 text-[12.5px] text-neutral-600">… et {shown.length - 50} autres lignes</div>}
                {!shown.length && <div className="px-5 py-8 text-center italic text-neutral-600">Toutes les lignes sont valides.</div>}
              </div>
            </Section>
            <Section className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-accent-300 bg-accent-100 p-3"><div className="tnum font-heading text-[34px] leading-none text-accent-800">{valid}</div><div className="text-[12px] text-accent-800">lignes valides</div></div>
                <div className="rounded-lg border border-divider p-3"><div className="tnum font-heading text-[34px] leading-none">{errors}</div><div className="text-[12px] text-neutral-700">à corriger</div></div>
              </div>
              <div className="text-[11px] tracking-[.1em] text-accent-700 uppercase">Ce qui va se passer</div>
              <ul className="flex flex-col gap-2.5 text-[13.5px]">
                <li className="flex gap-2.5"><Icon name="user-plus" size={16} className="mt-0.5 flex-none text-accent-700" />{valid} comptes élèves créés et rattachés à leur classe.</li>
                <li className="flex gap-2.5"><Icon name="message-square" size={16} className="mt-0.5 flex-none text-accent-700" />Un SMS d’activation est envoyé à chaque numéro.</li>
                <li className="flex gap-2.5"><Icon name="circle-alert" size={16} className="mt-0.5 flex-none text-accent-700" />{errors ? `${errors} lignes en erreur ne seront pas importées tant qu’elles ne sont pas corrigées.` : 'Aucune ligne en erreur.'}</li>
              </ul>
              <Button icon="check" disabled={!valid || f.state !== 'idle'} onClick={confirm}>Importer {valid} élèves</Button>
            </Section>
          </div>
        </>
      )}

      {done && (
        <Section className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full border-[1.5px] border-accent bg-accent-100 text-accent-800"><Icon name="check" size={28} /></div>
          <h2 className="text-[34px] font-normal">{valid} élèves importés</h2>
          <p className="max-w-md text-[14px] text-neutral-700">Les comptes sont créés. Les SMS d’activation partent par lots ; vous pouvez fermer cette page.</p>
          <div className="flex gap-2"><a href="/ecole" className="inline-flex min-h-10 items-center rounded-md border border-divider px-4 font-heading font-semibold no-underline">Retour au tableau de bord</a>
            <Button onClick={() => { setStep(2); setRows([]); f.reset(); }}>Nouvel import</Button></div>
        </Section>
      )}
    </>
  );
}
