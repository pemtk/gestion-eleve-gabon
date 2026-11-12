import Constants from 'expo-constants';

/** Émulateur Android : http://10.0.2.2:3000/api ; appareil réel : l'adresse IP de la machine. */
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
/** Réseau indisponible (≠ erreur métier) : l'action peut être gardée et rejouée. */
export class NetworkError extends Error {}

let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError('Pas de réseau.');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, Array.isArray(data?.message) ? data.message.join(' · ') : (data?.message ?? 'Une erreur est survenue.'));
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b),
  put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b),
};
