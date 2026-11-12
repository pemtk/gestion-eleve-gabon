/** Formats français : virgule décimale, espace insécable pour les milliers. */
export const nf = new Intl.NumberFormat('fr-FR');
export const formatInt = (n: number) => nf.format(n);

export function formatGrade(value: number): string {
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

export function average(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Code d'invitation parent à 6 chiffres, affiché « 482 917 ». */
export function formatCode(code: string): string {
  return code.replace(/\D/g, '').replace(/(\d{3})(\d{3})/, '$1 $2');
}
