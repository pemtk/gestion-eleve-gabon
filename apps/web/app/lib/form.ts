/** Lit un champ texte d'un FormData. */
export const str = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
/** Lit une case à cocher / un interrupteur. */
export const flag = (fd: FormData, key: string) => fd.get(key) === 'on' || fd.get(key) === 'true';
