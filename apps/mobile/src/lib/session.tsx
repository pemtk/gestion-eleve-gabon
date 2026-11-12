import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import type { Role, SessionUser } from '@sge/shared';
import { api, ApiError, NetworkError, request, setToken } from './api';
import { local, secure } from './storage';

interface QueuedAction { id: string; method: string; path: string; body?: unknown }
interface Ctx {
  ready: boolean;
  user: SessionUser | null;
  signIn: (token: string, user: SessionUser) => Promise<void>;
  signOut: () => Promise<void>;
  /** Mode hors ligne : réel (échec réseau) ou simulé depuis la barre d'état (démo). */
  offline: boolean;
  setOffline: (v: boolean) => void;
  pending: number;
  /** Envoie une action ; hors ligne elle est gardée sur le téléphone puis rejouée au retour du réseau. */
  send: <T = unknown>(method: 'POST' | 'PUT', path: string, body?: unknown) => Promise<{ queued: boolean; data?: T }>;
}

const SessionContext = createContext<Ctx | null>(null);
export const useSession = () => {
  const c = useContext(SessionContext);
  if (!c) throw new Error('useSession hors du SessionProvider');
  return c;
};

export const HOME: Record<string, string> = { eleve: '/eleve', parent: '/parent', enseignant: '/prof' };
export const ROLE_PREFIX: Record<string, string> = HOME;
const QUEUE_KEY = 'sge.outbox';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [offline, setOffline] = useState(false);
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const queueRef = useRef<QueuedAction[]>([]);
  const router = useRouter();

  const persist = useCallback((q: QueuedAction[]) => { queueRef.current = q; setQueue(q); void local.setItem(QUEUE_KEY, JSON.stringify(q)); }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [t, u, q] = await Promise.all([secure.get('sge.token'), local.getItem('sge.user'), local.getItem(QUEUE_KEY)]);
        if (t && u) { setToken(t); setUser(JSON.parse(u)); }
        if (q) { queueRef.current = JSON.parse(q); setQueue(queueRef.current); }
      } finally { setReady(true); }
    })();
  }, []);

  const signIn = useCallback(async (token: string, u: SessionUser) => {
    setToken(token); setUser(u);
    await Promise.all([secure.set('sge.token', token), local.setItem('sge.user', JSON.stringify(u))]);
  }, []);

  const signOut = useCallback(async () => {
    setToken(null); setUser(null);
    await Promise.all([secure.del('sge.token'), local.removeItem('sge.user')]);
    router.replace('/login');
  }, [router]);

  const flush = useCallback(async () => {
    for (const a of [...queueRef.current]) {
      try {
        await request(a.method, a.path, a.body);
      } catch (e) {
        if (e instanceof NetworkError) return; // on réessaiera
        if (e instanceof ApiError && e.status === 401) return;
        // erreur métier : l'action est abandonnée pour ne pas bloquer la file
      }
      persist(queueRef.current.filter((x) => x.id !== a.id));
    }
  }, [persist]);

  // Retour du réseau (ou fin de la simulation) : on rejoue la file, dans l'ordre.
  useEffect(() => { if (!offline && user && queue.length) void flush(); }, [offline, user, queue.length, flush]);
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => { if (!offline && queueRef.current.length) void flush(); }, 15000);
    return () => clearInterval(t);
  }, [user, offline, flush]);

  const send = useCallback<Ctx['send']>(async (method, path, body) => {
    const enqueue = () => { persist([...queueRef.current, { id: `${Date.now()}-${Math.random()}`, method, path, body }]); return { queued: true as const }; };
    if (offline) return enqueue();
    try {
      return { queued: false, data: (await request(method, path, body)) as never };
    } catch (e) {
      if (e instanceof NetworkError) { setOffline(true); return enqueue(); }
      throw e;
    }
  }, [offline, persist]);

  const value = useMemo(() => ({ ready, user, signIn, signOut, offline, setOffline, pending: queue.length, send }), [ready, user, signIn, signOut, offline, queue.length, send]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export type { Role };
export { api };
