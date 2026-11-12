import { Injectable } from '@nestjs/common';
import { LEVEL_FACTOR, PROVINCES, maskSmallCell } from '@sge/shared';

export type Level = keyof typeof LEVEL_FACTOR;
const REPORT_COUNTS: { type: string; open: number; inProgress: number; closed: number }[] = [
  { type: 'Conduite / engagement', open: 46, inProgress: 31, closed: 212 },
  { type: 'Confidentiel — harcèlement', open: 7, inProgress: 12, closed: 38 },
  { type: 'Confidentiel — mal-être', open: 4, inProgress: 6, closed: 17 },
  { type: 'Confidentiel — difficulté personnelle', open: 11, inProgress: 8, closed: 24 },
];

/** Données agrégées et anonymisées (§9) : jamais de nom, cellules de moins de 10 masquées. */
@Injectable()
export class PartnerService {
  provinces(region: string, level: Level) {
    const factor = LEVEL_FACTOR[level] ?? 1;
    return PROVINCES.filter(([name]) => region === 'Toutes' || (region === 'Estuaire' ? name === 'Estuaire' : name !== 'Estuaire')).map(([province, schools, ...cells]) => ({
      province, schools,
      cells: cells.map((cell, j) => {
        if (cell === 'masqué') return null;
        // activation, complétion, présence suivent le niveau ; le volume de signalements non.
        return j <= 2 && factor !== 1 ? `${Math.min(99, Math.round(parseInt(cell, 10) * factor))} %` : cell;
      }),
    }));
  }

  reports() {
    return REPORT_COUNTS.map((r) => ({ type: r.type, open: maskSmallCell(r.open), inProgress: maskSmallCell(r.inProgress), closed: maskSmallCell(r.closed) }));
  }

  /** Export CSV : les cellules masquées restent vides. */
  exportCsv(): string {
    const lines = ['type;ouverts;en cours;clos', ...this.reports().map((r) => [r.type, r.open ?? '', r.inProgress ?? '', r.closed ?? ''].join(';'))];
    return lines.join('\n');
  }
}
