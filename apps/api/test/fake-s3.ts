import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeS3 {
  url: string;
  objects: Map<string, { body: Buffer; contentType: string }>;
  requests: {
    method: string;
    path: string;
    authorization?: string;
    query: URLSearchParams;
  }[];
  close(): Promise<void>;
}

/**
 * Faux service S3 (chemin « path-style ») pour les tests : garde les objets en mémoire et exige soit un en-tête de signature SigV4,
 * soit les paramètres d'un lien présigné. Ne vérifie pas la signature elle-même : il atteste que le client a bien signé sa requête.
 */
export async function fakeS3(bucket: string): Promise<FakeS3> {
  const objects: FakeS3['objects'] = new Map();
  const requests: FakeS3['requests'] = [];
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://localhost');
    const key = decodeURIComponent(
      url.pathname.replace(new RegExp(`^/${bucket}/`), ''),
    );
    requests.push({
      method: req.method!,
      path: url.pathname,
      authorization: req.headers.authorization,
      query: url.searchParams,
    });
    const presigned =
      url.searchParams.has('X-Amz-Signature') &&
      url.searchParams.get('X-Amz-Algorithm') === 'AWS4-HMAC-SHA256';
    const signed =
      !!req.headers.authorization?.startsWith('AWS4-HMAC-SHA256 Credential=') ||
      presigned;
    if (!signed) {
      res.writeHead(403).end('<Error><Code>AccessDenied</Code></Error>');
      return;
    }
    if (req.method === 'PUT') {
      const chunks: Buffer[] = [];
      req.on('data', (d: Buffer) => chunks.push(d));
      req.on('end', () => {
        objects.set(key, {
          body: Buffer.concat(chunks),
          contentType: String(req.headers['content-type'] ?? ''),
        });
        res.writeHead(200, { ETag: '"fake"' }).end();
      });
      return;
    }
    const object = objects.get(key);
    if (req.method === 'DELETE') {
      objects.delete(key);
      res.writeHead(204).end();
      return;
    }
    if (!object) {
      res
        .writeHead(404, { 'Content-Type': 'application/xml' })
        .end(
          '<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>absent</Message></Error>',
        );
      return;
    }
    res
      .writeHead(200, {
        'Content-Type':
          url.searchParams.get('response-content-type') ?? object.contentType,
        'Content-Length': object.body.length,
        ...(url.searchParams.get('response-content-disposition')
          ? {
              'Content-Disposition': url.searchParams.get(
                'response-content-disposition',
              )!,
            }
          : {}),
      })
      .end(object.body);
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    objects,
    requests,
    close: () =>
      new Promise((ok) => {
        server.close(() => ok());
        server.closeAllConnections();
      }),
  };
}
