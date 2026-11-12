import { describe, expect, it } from 'vitest';
import { PartnerService } from './partner.service.js';

describe('PartnerService', () => {
  const partner = new PartnerService();

  it('masque toute cellule de moins de 10 individus', () => {
    const rows = partner.reports();
    expect(rows[0]).toMatchObject({ open: 46, inProgress: 31, closed: 212 });
    expect(rows[1]?.open).toBeNull(); // 7 → masqué
    expect(rows[2]).toMatchObject({ open: null, inProgress: null, closed: 17 });
  });

  it('exporte un CSV sans valeur masquée', () => {
    const csv = partner.exportCsv().split('\n');
    expect(csv[2]).toBe('Confidentiel — harcèlement;;12;38');
  });

  it('filtre par région et ajuste par niveau sans exposer les cellules masquées', () => {
    const interior = partner.provinces('Intérieur', 'Tous');
    expect(interior.some((r) => r.province === 'Estuaire')).toBe(false);
    const lycee = partner.provinces('Estuaire', 'Lycée');
    expect(lycee[0]?.cells[0]).toBe('82 %');
    expect(partner.provinces('Toutes', 'Tous').find((r) => r.province === 'Ogooué-Lolo')?.cells.slice(0, 4)).toEqual([null, null, null, null]);
  });
});
