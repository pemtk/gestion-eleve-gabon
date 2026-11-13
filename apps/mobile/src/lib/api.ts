import Constants from 'expo-constants';

/** Émulateur Android : http://10.0.2.2:3000/api ; appareil réel : l'adresse IP de la machine. */
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
/** Réseau indisponible (≠ erreur métier) : l'action peut être gardée et rejouée. */
export class NetworkError extends Error {}

let token: string | null = null;
let refreshToken: string | null = null;
/** Appelés par la session : enregistrer les nouveaux jetons / retourner à la connexion quand la session est perdue. */
let onTokens: (access: string, refresh: string) => void = () => undefined;
let onExpired: () => void = () => undefined;
export const setTokens = (access: string | null, refresh: string | null) => { token = access; refreshToken = refresh; };
export const getRefreshToken = () => refreshToken;
export const onSession = (handlers: { tokens: typeof onTokens; expired: typeof onExpired }) => { onTokens = handlers.tokens; onExpired = handlers.expired; };

async function send(method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError('Pas de réseau.');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  return { res, data };
}

/** Un seul renouvellement à la fois : les requêtes qui échouent ensemble attendent le même résultat (le jeton ne sert qu'une fois). */
let renewing: Promise<boolean> | null = null;
function renew(): Promise<boolean> {
  renewing ??= (async () => {
    if (!refreshToken) return false;
    try {
      const { res, data } = await send('POST', '/auth/refresh', { refreshToken });
      if (!res.ok) return false;
      token = data.accessToken; refreshToken = data.refreshToken;
      onTokens(data.accessToken, data.refreshToken);
      return true;
    } catch (e) {
      if (e instanceof NetworkError) throw e; // hors ligne : on garde la session
      return false;
    } finally {
      setTimeout(() => { renewing = null; }, 0);
    }
  })();
  return renewing;
}

export async function request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  let { res, data } = await send(method, path, body, headers);
  // Jeton d'accès expiré (15 min) : on le renouvelle en silence puis on rejoue la requête une fois.
  if (res.status === 401 && token && !path.startsWith('/auth/') && await renew()) ({ res, data } = await send(method, path, body, headers));
  if (res.status === 401 && token && !path.startsWith('/auth/')) onExpired();
  if (!res.ok) throw new ApiError(res.status, Array.isArray(data?.message) ? data.message.join(' · ') : (data?.message ?? 'Une erreur est survenue.'));
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown, h?: Record<string, string>) => request<T>('POST', p, b, h),
  put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b),
};
