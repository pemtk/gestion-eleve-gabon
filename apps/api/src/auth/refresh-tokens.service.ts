import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { DB, type Db } from '../db/db.module.js';
import { refreshTokens } from '../db/schema.js';

export const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 15 * 60);
const REFRESH_TTL_MS = 14 * 24 * 3600_000;
/** Durée maximale d'une session, renouvellements compris : au-delà, il faut se reconnecter. */
const FAMILY_MAX_MS = 30 * 24 * 3600_000;
/** Deux requêtes simultanées avec le même jeton : la perdante n'est pas une attaque. */
const RACE_GRACE_MS = 10_000;

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');
const invalid = () => new UnauthorizedException('Session expirée, reconnectez-vous.');

function parse(token: string): { id: string; secret: string } | null {
  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return null;
  return { id: token.slice(0, dot), secret: token.slice(dot + 1) };
}

/**
 * Jetons de renouvellement : `<id>.<secret>`, seul le haché du secret est stocké.
 * Rotation à chaque usage ; présenter de nouveau un jeton déjà remplacé révoque toute la session (famille).
 */
@Injectable()
export class RefreshTokens {
  constructor(@Inject(DB) private readonly db: Db) {}

  private async insert(userId: string, familyId: string, startedAt: Date) {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    await this.db.insert(refreshTokens).values({ id, userId, familyId, tokenHash: hash(secret), expiresAt: new Date(Date.now() + REFRESH_TTL_MS), familyStartedAt: startedAt });
    return { id, token: `${id}.${secret}` };
  }

  /** Nouvelle session (connexion). */
  issue(userId: string) {
    return this.insert(userId, randomUUID(), new Date());
  }

  /**
   * Renouvelle : retourne l'utilisateur et le jeton qui remplace celui présenté.
   * `reuse` signale qu'un jeton déjà remplacé a été rejoué (la session entière vient d'être révoquée).
   */
  async rotate(token: string): Promise<{ userId: string; token: string }> {
    const parsed = parse(token);
    if (!parsed) throw invalid();
    const [row] = await this.db.select().from(refreshTokens).where(eq(refreshTokens.id, parsed.id));
    const given = Buffer.from(hash(parsed.secret));
    const stored = Buffer.from(row?.tokenHash ?? '');
    if (!row || given.length !== stored.length || !timingSafeEqual(given, stored)) throw invalid();
    if (row.revokedAt) {
      // Remplacé il y a quelques secondes : course entre deux requêtes ; plus tard : rejeu, on coupe toute la session.
      if (!row.replacedBy || Date.now() - row.revokedAt.getTime() > RACE_GRACE_MS) await this.revokeFamilyById(row.familyId);
      throw invalid();
    }
    if (row.expiresAt.getTime() < Date.now() || Date.now() - row.familyStartedAt.getTime() > FAMILY_MAX_MS) throw invalid();
    const next = await this.db.transaction(async (tx) => {
      const [claimed] = await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.id, row.id), isNull(refreshTokens.revokedAt))).returning({ id: refreshTokens.id });
      if (!claimed) throw invalid(); // une autre requête l'a déjà utilisé à l'instant
      const id = randomUUID();
      const secret = randomBytes(32).toString('base64url');
      await tx.insert(refreshTokens).values({ id, userId: row.userId, familyId: row.familyId, tokenHash: hash(secret), expiresAt: new Date(Date.now() + REFRESH_TTL_MS), familyStartedAt: row.familyStartedAt });
      await tx.update(refreshTokens).set({ replacedBy: id }).where(eq(refreshTokens.id, row.id));
      return `${id}.${secret}`;
    });
    return { userId: row.userId, token: next };
  }

  private async revokeFamilyById(familyId: string) {
    await this.db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }

  /** Déconnexion de cet appareil (idempotente : un jeton inconnu est ignoré). */
  async revoke(token: string): Promise<void> {
    const parsed = token ? parse(token) : null;
    if (!parsed) return;
    const [row] = await this.db.select({ familyId: refreshTokens.familyId }).from(refreshTokens).where(eq(refreshTokens.id, parsed.id));
    if (row) await this.revokeFamilyById(row.familyId);
  }

  /** Déconnecte tous les appareils d'un utilisateur, sauf éventuellement la session du jeton `except`. */
  async revokeAll(userId: string, except?: string): Promise<void> {
    const parsed = except ? parse(except) : null;
    const [keep] = parsed ? await this.db.select({ familyId: refreshTokens.familyId }).from(refreshTokens).where(and(eq(refreshTokens.id, parsed.id), eq(refreshTokens.userId, userId))) : [];
    await this.db.update(refreshTokens).set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt), keep ? ne(refreshTokens.familyId, keep.familyId) : undefined));
  }
}
