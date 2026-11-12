import { data, redirect } from 'react-router';
import type { WebSpace } from '@sge/shared';
import { destroyUserSession, requireUser } from './session.server';

const BASE = process.env.API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, token?: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(503, 'Le serveur est injoignable. Réessayez dans un instant.');
  }
  const type = res.headers.get('content-type') ?? '';
  const payload = type.includes('json') ? await res.json() : await res.text();
  if (!res.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(' · ') : (payload?.message ?? 'Une erreur est survenue.');
    throw new ApiError(res.status, message, payload?.code);
  }
  return payload as T;
}

/** Appels non authentifiés (connexion). */
export const publicApi = {
  post: <T>(path: string, body?: unknown) => call<T>('POST', path, undefined, body),
};

/** Client lié à la session de l'espace : une session expirée renvoie vers la connexion. */
export async function spaceApi(request: Request, space: WebSpace) {
  const { token, user } = await requireUser(request, space);
  const wrap = async <T>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) throw await destroyUserSession(request);
      throw e;
    }
  };
  return {
    user,
    get: <T>(path: string) => wrap(() => call<T>('GET', path, token)),
    post: <T>(path: string, body?: unknown) => wrap(() => call<T>('POST', path, token, body)),
    put: <T>(path: string, body?: unknown) => wrap(() => call<T>('PUT', path, token, body)),
    patch: <T>(path: string, body?: unknown) => wrap(() => call<T>('PATCH', path, token, body)),
    del: <T>(path: string) => wrap(() => call<T>('DELETE', path, token)),
  };
}

export type ActionResult = { ok: true; message: string } | { ok: false; error: string; code?: string };

/** Exécute une mutation et la traduit en message (succès) ou erreur affichable. */
export async function run<T>(fn: () => Promise<T>, success: string | ((result: T) => string)) {
  try {
    const result = await fn();
    return data<ActionResult>({ ok: true, message: typeof success === 'function' ? success(result) : success });
  } catch (e) {
    if (e instanceof Response) throw e;
    if (e instanceof ApiError) return data<ActionResult>({ ok: false, error: e.message, code: e.code }, { status: e.status });
    throw e;
  }
}

export { redirect };
