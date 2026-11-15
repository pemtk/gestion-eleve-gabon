import { randomInt } from 'node:crypto';

/** Code parent à 6 chiffres, unique sur toute la plateforme : on retente en cas de collision (contrainte UNIQUE). */
export const code = () => String(randomInt(100000, 1000000));
