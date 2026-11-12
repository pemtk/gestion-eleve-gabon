import { describe, expect, it } from 'vitest';
import { buildStudentCsv, parseStudentCsv, validateStudentRow } from './csv.js';

const classes = ['3ème B', '4ème A'];

describe('parseStudentCsv', () => {
  it('accepte les lignes valides et signale les erreurs ligne par ligne', () => {
    const csv = [
      'nom,prénom,téléphone,classe',
      'Mboumba,Ruth,+241 07 55 12 90,3ème B',
      'Obame,Léa,07 7,4ème A',
      'Mouketou,,07 31 66 02 11,3ème B',
      'Eyeghe,Paul,07 90 21 45 10,6ème Z',
    ].join('\n');
    const { rows, missingColumns } = parseStudentCsv(csv, classes);
    expect(missingColumns).toEqual([]);
    expect(rows.map((r) => r.error)).toEqual([undefined, 'Numéro trop court', 'Prénom manquant', 'Classe inconnue']);
    expect(rows[1]?.line).toBe(3);
  });

  it('gère le point-virgule et signale les colonnes manquantes', () => {
    expect(parseStudentCsv('nom;prénom;téléphone;classe\nA;B;07123456;3ème B', classes).rows[0]?.error).toBeUndefined();
    expect(parseStudentCsv('nom;prénom\nA;B', classes).missingColumns).toEqual(['téléphone', 'classe']);
  });
});

describe('validateStudentRow / buildStudentCsv', () => {
  it('revalide une ligne corrigée', () => {
    const row = { line: 14, nom: 'Obame', prenom: 'Léa', phone: '+241 07 55 12 90', classe: '3ème B' };
    expect(validateStudentRow({ ...row, phone: '07 7' }, classes)).toBe('Numéro trop court');
    expect(validateStudentRow(row, classes)).toBeUndefined();
  });
  it('reconstruit un CSV relisible', () => {
    const csv = buildStudentCsv([{ nom: 'Mba', prenom: 'Léa', phone: '07 12 34 56', classe: '3ème B' }]);
    expect(parseStudentCsv(csv, classes).rows[0]?.error).toBeUndefined();
  });
});

describe('numéros en double', () => {
  it('refuse un numéro déjà présent plus haut dans le fichier (un numéro = un compte)', () => {
    const csv = ['nom,prénom,téléphone,classe', 'A,Un,+241 07 11 22 33,3ème B', 'B,Deux,07 11 22 33,3ème B', 'C,Trois,07 99 88 77,4ème A'].join('\n');
    const { rows } = parseStudentCsv(csv, classes);
    expect(rows.map((r) => r.error)).toEqual([undefined, 'Numéro en double dans le fichier', undefined]);
  });
});

