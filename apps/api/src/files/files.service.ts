import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  type OnModuleInit,
} from '@nestjs/common';
import { and, eq, lt } from 'drizzle-orm';
import {
  FILE_KINDS,
  FILE_POLICIES,
  acceptedTypes,
  formatBytes,
  type FileKind,
  type StoredFile,
} from '@sge/shared';
import { randomUUID } from 'node:crypto';
import type { Executor } from '../accounts/accounts.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth.js';
import { RateLimiter, type Limit } from '../common/rate-limiter.js';
import { DB, type Db } from '../db/db.module.js';
import { files } from '../db/schema.js';
import { canRead } from './access.js';
import { stripJpegMetadata } from './jpeg.js';
import { signatureOf, verifySignature } from './signing.js';
import { safeName, sniffType } from './sniff.js';
import { storageFromEnv, type ObjectStorage } from './storage.js';

type FileRow = typeof files.$inferSelect;
/** 30 envois par heure et par utilisateur : largement assez pour l'usage normal, trop peu pour saturer le stockage. */
const UPLOAD_LIMIT: Limit = {
  max: 30,
  windowMs: 3600_000,
  blockMs: 10 * 60_000,
};
export const LINK_TTL_SECONDS = 300;
const ORPHAN_AGE_MS = 24 * 3600_000;

export interface Upload {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size: number;
}
export const toStored = (f: FileRow): StoredFile => ({
  id: f.id,
  kind: f.kind as FileKind,
  name: f.name,
  contentType: f.contentType,
  size: f.size,
});

/** Envoi, rattachement et lecture des fichiers. Le stockage des octets est interchangeable (disque, S3) ; les droits sont en base. */
@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger('Fichiers');
  readonly storage: ObjectStorage = storageFromEnv();
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly limiter: RateLimiter,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.logger.log(
      `Stockage des fichiers : ${this.storage.driver === 's3' ? 'S3' : `disque (${process.env.FILES_DIR ?? './data/files'})`}`,
    );
    if (process.env.NODE_ENV === 'test' || process.env.FILES_PURGE === 'off')
      return;
    const timer = setInterval(
      () =>
        void this.purgeOrphans().catch((e) =>
          this.logger.error(`Purge des fichiers orphelins : ${String(e)}`),
        ),
      3600_000,
    );
    timer.unref();
  }

  /** Reçoit un fichier : profil autorisé, type réel (octets) et taille conformes à l'usage, métadonnées JPEG retirées. */
  async upload(
    user: AuthUser,
    kindInput: string | undefined,
    file: Upload | undefined,
  ): Promise<StoredFile> {
    const kind = FILE_KINDS.find((k) => k === kindInput);
    if (!kind)
      throw new BadRequestException(
        `Usage du fichier inconnu (${FILE_KINDS.join(', ')}).`,
      );
    const policy = FILE_POLICIES[kind];
    if (!policy.roles.includes(user.role))
      throw new ForbiddenException(
        'Votre profil ne peut pas envoyer ce type de fichier.',
      );
    if (!file || !file.size)
      throw new BadRequestException('Aucun fichier reçu.');
    await this.limiter.check(`upload:${user.sub}`);
    if (file.size > policy.maxBytes)
      throw new PayloadTooLargeException(
        `${policy.label} : ${formatBytes(policy.maxBytes)} au maximum.`,
      );
    const type = sniffType(file.buffer);
    if (!type || !policy.types.includes(type))
      throw new UnsupportedMediaTypeException(
        `Format non accepté pour « ${policy.label.toLowerCase()} » : ${acceptedTypes(kind)}.`,
      );
    await this.limiter.hit(`upload:${user.sub}`, UPLOAD_LIMIT);
    const body =
      type === 'image/jpeg' ? stripJpegMetadata(file.buffer) : file.buffer;
    const id = randomUUID();
    const storageKey = `${user.schoolId ?? 'hors-ecole'}/${id}`;
    await this.storage.put(storageKey, body, type);
    try {
      const [row] = await this.db
        .insert(files)
        .values({
          id,
          schoolId: user.schoolId,
          ownerId: user.sub,
          kind,
          name: safeName(file.originalname, type),
          contentType: type,
          size: body.length,
          storageKey,
        })
        .returning();
      return toStored(row!);
    } catch (e) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw e;
    }
  }

  /** Rattache un fichier en attente à son objet. Réservé à son propriétaire, pour le bon usage, et une seule fois. */
  async attach(
    ex: Executor,
    user: AuthUser,
    fileId: string,
    kind: FileKind,
    refType: string,
    refId: string,
    schoolId?: string,
  ): Promise<FileRow> {
    const [row] = await ex
      .update(files)
      .set({
        status: 'attached',
        refType,
        refId,
        ...(schoolId ? { schoolId } : {}),
      })
      .where(
        and(
          eq(files.id, fileId),
          eq(files.ownerId, user.sub),
          eq(files.kind, kind),
          eq(files.status, 'pending'),
        ),
      )
      .returning();
    if (!row)
      throw new BadRequestException(
        'Fichier introuvable ou déjà utilisé : envoyez-le de nouveau.',
      );
    return row;
  }

  async remove(fileId: string): Promise<void> {
    const [row] = await this.db
      .delete(files)
      .where(eq(files.id, fileId))
      .returning();
    if (row)
      await this.storage
        .delete(row.storageKey)
        .catch((e) =>
          this.logger.warn(
            `Suppression de l'objet ${row.storageKey} : ${String(e)}`,
          ),
        );
  }

  /** Métadonnées d'un fichier lisible par l'utilisateur ; sinon « introuvable » (on ne révèle pas qu'il existe). */
  async find(user: AuthUser, id: string, ip?: string): Promise<FileRow> {
    const [row] = await this.db.select().from(files).where(eq(files.id, id));
    const allowed = !!row && (await canRead(this.db, user, row));
    // Les accès à des photos d'enfants par un tiers (enseignant, parent) et les refus sont tracés.
    if (
      row &&
      row.ownerId !== user.sub &&
      (row.kind === 'proof' || row.kind === 'report')
    ) {
      await this.audit.record({
        action: 'file.read',
        resourceType: 'file',
        resourceId: id,
        outcome: allowed ? 'ok' : 'refuse',
        user,
        ip,
        details: { kind: row.kind },
      });
    }
    if (!row || !allowed) throw new NotFoundException('Fichier introuvable.');
    return row;
  }

  async content(row: FileRow): Promise<Buffer> {
    const body = await this.storage.get(row.storageKey);
    if (!body) throw new NotFoundException('Fichier indisponible.');
    return body;
  }

  /** Lien temporaire (5 min) : direct vers le stockage S3 s'il sait signer, sinon vers l'API avec une signature HMAC. */
  async link(row: FileRow): Promise<{ url: string; expiresAt: string }> {
    const expires = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
    const direct = await this.storage.signedUrl(
      row.storageKey,
      LINK_TTL_SECONDS,
      { contentType: row.contentType, filename: row.name },
    );
    const base = process.env.API_PUBLIC_URL ?? '/api';
    return {
      url:
        direct ??
        `${base}/files/${row.id}/content?exp=${expires}&sig=${signatureOf(row.id, expires)}`,
      expiresAt: new Date(expires * 1000).toISOString(),
    };
  }

  /** Lecture par lien signé : sans session, pour un seul fichier et jusqu'à l'échéance. */
  async bySignature(
    id: string,
    expires: number,
    signature: string,
  ): Promise<FileRow> {
    if (!verifySignature(id, expires, signature))
      throw new NotFoundException('Lien expiré ou invalide.');
    const [row] = await this.db.select().from(files).where(eq(files.id, id));
    if (!row) throw new NotFoundException('Fichier introuvable.');
    return row;
  }

  /** Un fichier en attente se supprime ; un fichier rattaché se retire par l'objet qui le porte. */
  async discard(user: AuthUser, id: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.ownerId, user.sub)));
    if (!row) throw new NotFoundException('Fichier introuvable.');
    if (row.status !== 'pending')
      throw new ForbiddenException(
        'Ce fichier est utilisé : retirez-le de l’élément qui le porte.',
      );
    await this.remove(id);
  }

  /** Supprime les fichiers envoyés mais jamais utilisés depuis plus de 24 h. */
  async purgeOrphans(olderThanMs = ORPHAN_AGE_MS): Promise<number> {
    const stale = await this.db
      .select()
      .from(files)
      .where(
        and(
          eq(files.status, 'pending'),
          lt(files.createdAt, new Date(Date.now() - olderThanMs)),
        ),
      );
    for (const f of stale) await this.remove(f.id);
    return stale.length;
  }
}
