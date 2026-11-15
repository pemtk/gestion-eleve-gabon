import { useState } from 'react';
import { useFetcher } from 'react-router';
import {
  IMPORT_PREVIEW,
  buildStudentCsv,
  parseStudentCsv,
  validateStudentRow,
  type CsvStudentRow,
} from '@sge/shared';

export type ImportStep = 'upload' | 'review';
const MAX_ROWS = 2000;

/**
 * État de l'assistant d'import d'élèves : lecture du fichier, vérification ligne par ligne,
 * corrections à la main, puis envoi des seules lignes valides.
 */
export function useStudentImport(classNames: string[]) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<CsvStudentRow[]>([]);
  const [onlyErrors, setOnlyErrors] = useState(true);
  const [fixing, setFixing] = useState<number | null>(null);
  const [problem, setProblem] = useState('');
  const submitter = useFetcher<{ ok: boolean; error?: string }>();

  const errors = rows.filter((row) => row.error).length;
  const valid = rows.length - errors;
  const shown = onlyErrors ? rows.filter((row) => row.error || row.line === fixing) : rows;
  const done = submitter.data?.ok === true;

  const load = (name: string, text: string) => {
    const parsed = parseStudentCsv(text, classNames);
    if (parsed.missingColumns.length) {
      setProblem(
        `Colonnes manquantes : ${parsed.missingColumns.join(', ')}. Téléchargez le modèle.`,
      );
    } else if (!parsed.rows.length) {
      setProblem('Le fichier ne contient aucune ligne.');
    } else if (parsed.rows.length > MAX_ROWS) {
      setProblem('2 000 lignes au maximum par fichier.');
    } else {
      setProblem('');
      setFileName(name);
      setRows(parsed.rows);
      setOnlyErrors(parsed.rows.some((row) => row.error));
      setStep('review');
    }
  };

  const loadFile = async (file?: File) => {
    if (file) load(file.name, await file.text());
  };

  /** Fichier d'exemple : la classe fictive est remplacée par une classe réelle de l'école. */
  const loadSample = () =>
    load(
      'exemple_eleves.csv',
      buildStudentCsv(
        IMPORT_PREVIEW.map((row) => ({
          nom: row.nom,
          prenom: row.prenom,
          phone: row.phone,
          classe: row.classe === 'Seconde A' ? (classNames[0] ?? row.classe) : row.classe,
        })),
      ),
    );

  /** Corrige une ligne et la revalide aussitôt. */
  const fix = (line: number, patch: Partial<CsvStudentRow>) =>
    setRows((current) =>
      current.map((row) => {
        if (row.line !== line) return row;
        const next = { ...row, ...patch, error: undefined };
        const error = validateStudentRow(next, classNames);
        return error ? { ...next, error } : next;
      }),
    );

  const confirm = () =>
    submitter.submit(
      { csv: buildStudentCsv(rows.filter((row) => !row.error)) },
      { method: 'post' },
    );

  const changeFile = () => {
    setStep('upload');
    setRows([]);
  };

  const restart = () => {
    changeFile();
    submitter.reset();
  };

  return {
    step,
    fileName,
    rows,
    shown,
    errors,
    valid,
    done,
    problem,
    fixing,
    onlyErrors,
    submitting: submitter.state !== 'idle',
    submitError: submitter.data && !submitter.data.ok ? submitter.data.error : undefined,
    loadFile,
    loadSample,
    fix,
    setFixing,
    setOnlyErrors,
    confirm,
    changeFile,
    restart,
  };
}
