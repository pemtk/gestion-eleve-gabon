import { normalizePhone } from './validation.js';

export interface CsvStudentRow { line: number; nom: string; prenom: string; phone: string; classe: string; error?: string }

/** Découpe une ligne CSV (séparateur « , » ou « ; », guillemets simples gérés). */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Vérifie un fichier d'import d'élèves (§7.5) : colonnes nom, prénom, téléphone, classe
 * obligatoires ; chaque ligne en erreur est signalée pour correction en ligne.
 */
export const STUDENT_CSV_HEADER = 'nom,prénom,téléphone,classe';

export function validateStudentRow(row: Omit<CsvStudentRow, 'error'>, knownClasses: string[]): string | undefined {
  if (!row.nom.trim()) return 'Nom manquant';
  if (!row.prenom.trim()) return 'Prénom manquant';
  if (normalizePhone(row.phone).length < 8) return 'Numéro trop court';
  if (!knownClasses.some((c) => c.toLowerCase() === row.classe.trim().toLowerCase())) return 'Classe inconnue';
  return undefined;
}

/** Reconstruit un CSV propre à partir des lignes (après corrections en ligne). */
export function buildStudentCsv(rows: Pick<CsvStudentRow, 'nom' | 'prenom' | 'phone' | 'classe'>[]): string {
  const esc = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '')}"` : v);
  return [STUDENT_CSV_HEADER, ...rows.map((r) => [r.nom, r.prenom, r.phone, r.classe].map(esc).join(','))].join('\n');
}

export function parseStudentCsv(text: string, knownClasses: string[]): { rows: CsvStudentRow[]; missingColumns: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], missingColumns: ['nom', 'prénom', 'téléphone', 'classe'] };
  const sep = lines[0]!.includes(';') ? ';' : ',';
  const header = splitLine(lines[0]!, sep).map((h) => h.toLowerCase());
  const idx = (name: string, alt: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? i : header.indexOf(alt);
  };
  const cols = { nom: idx('nom', 'nom'), prenom: idx('prénom', 'prenom'), phone: idx('téléphone', 'telephone'), classe: idx('classe', 'classe') };
  const missingColumns = [cols.nom < 0 && 'nom', cols.prenom < 0 && 'prénom', cols.phone < 0 && 'téléphone', cols.classe < 0 && 'classe'].filter(Boolean) as string[];
  if (missingColumns.length) return { rows: [], missingColumns };

  const rows = lines.slice(1).map((raw, i): CsvStudentRow => {
    const c = splitLine(raw, sep);
    const row: CsvStudentRow = { line: i + 2, nom: c[cols.nom] ?? '', prenom: c[cols.prenom] ?? '', phone: c[cols.phone] ?? '', classe: c[cols.classe] ?? '' };
    const error = validateStudentRow(row, knownClasses);
    if (error) row.error = error;
    return row;
  });
  return { rows, missingColumns: [] };
}
