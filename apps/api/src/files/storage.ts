import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

/** Stockage des octets. Les métadonnées et les droits d'accès sont en base ; ici, seulement des objets identifiés par une clé. */
export interface ObjectStorage {
  readonly driver: 'local' | 's3';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /** Lien direct vers l'objet, valable `ttlSeconds` secondes ; `null` si le stockage ne sait pas en fabriquer (l'API sert alors le fichier). */
  signedUrl(
    key: string,
    ttlSeconds: number,
    opts: { contentType: string; filename: string },
  ): Promise<string | null>;
}

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;
function assertKey(key: string): void {
  if (
    !SAFE_KEY.test(key) ||
    key.split('/').some((p) => p === '..' || p === '.' || p === '')
  )
    throw new Error('Clé de fichier invalide.');
}

/** Disque local (développement, petite installation) : un dossier, un fichier par objet. */
export class LocalDiskStorage implements ObjectStorage {
  readonly driver = 'local' as const;
  private readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }

  private path(key: string): string {
    assertKey(key);
    const full = resolve(join(this.root, key));
    if (!full.startsWith(this.root + sep))
      throw new Error('Clé de fichier invalide.');
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body, { mode: 0o600 });
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.path(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  async signedUrl(): Promise<null> {
    return null;
  }
}

/** Stockage objet compatible S3 (AWS S3, Scaleway, OVH, MinIO, Cloudflare R2…). */
export class S3Storage implements ObjectStorage {
  readonly driver = 's3' as const;
  private readonly client: S3Client;
  constructor(
    private readonly bucket: string,
    config: S3ClientConfig,
  ) {
    this.client = new S3Client(config);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption:
          process.env.FILES_S3_SSE === 'true' ? 'AES256' : undefined,
      }),
    );
  }

  async get(key: string): Promise<Buffer | null> {
    assertKey(key);
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return Buffer.from(await res.Body!.transformToByteArray());
    } catch (e) {
      if ((e as { name?: string }).name === 'NoSuchKey') return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    assertKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  signedUrl(
    key: string,
    ttlSeconds: number,
    opts: { contentType: string; filename: string },
  ): Promise<string> {
    assertKey(key);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: opts.contentType,
        ResponseContentDisposition: `${opts.contentType === 'application/pdf' ? 'attachment' : 'inline'}; filename="${opts.filename.replace(/"/g, '')}"`,
      }),
      { expiresIn: ttlSeconds },
    );
  }
}

/**
 * Choix du stockage par l'environnement : `FILES_DRIVER=s3` avec `FILES_S3_BUCKET` (+ `FILES_S3_ENDPOINT` pour un service compatible,
 * `FILES_S3_REGION`, `FILES_S3_ACCESS_KEY_ID` / `FILES_S3_SECRET_ACCESS_KEY` ou la chaîne d'identifiants AWS) ; sinon le disque (`FILES_DIR`).
 */
export function storageFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ObjectStorage {
  if (env.FILES_DRIVER === 's3') {
    if (!env.FILES_S3_BUCKET)
      throw new Error('FILES_S3_BUCKET est obligatoire avec FILES_DRIVER=s3.');
    return new S3Storage(env.FILES_S3_BUCKET, {
      region: env.FILES_S3_REGION ?? 'us-east-1',
      endpoint: env.FILES_S3_ENDPOINT,
      forcePathStyle: !!env.FILES_S3_ENDPOINT,
      credentials:
        env.FILES_S3_ACCESS_KEY_ID && env.FILES_S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.FILES_S3_ACCESS_KEY_ID,
              secretAccessKey: env.FILES_S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }
  return new LocalDiskStorage(env.FILES_DIR ?? './data/files');
}
