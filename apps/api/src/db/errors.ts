/** Violation de contrainte UNIQUE PostgreSQL (23505). Drizzle enveloppe l'erreur du pilote dans `cause`. */
export function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown) => (x as { code?: string } | null)?.code;
  return code(e) === '23505' || code((e as { cause?: unknown } | null)?.cause) === '23505';
}
