import { createHmac, timingSafeEqual } from 'node:crypto';

/** Clé de signature des liens de fichiers : dédiée si elle est définie, sinon celle des jetons de session. */
export function signingSecret(): string {
  const secret = process.env.FILES_SIGNING_SECRET ?? process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('FILES_SIGNING_SECRET ou JWT_SECRET est obligatoire en production.');
  return 'dev-only-secret-change-me';
}

export const signatureOf = (fileId: string, expires: number, secret = signingSecret()): string => createHmac('sha256', secret).update(`${fileId}.${expires}`).digest('base64url');

/** Lien valable jusqu'à `expires` (secondes Unix) pour CE fichier uniquement : ni l'identifiant ni la date ne peuvent être changés. */
export function verifySignature(fileId: string, expires: number, signature: string, now = Date.now(), secret = signingSecret()): boolean {
  if (!Number.isFinite(expires) || expires * 1000 < now) return false;
  const expected = Buffer.from(signatureOf(fileId, expires, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
