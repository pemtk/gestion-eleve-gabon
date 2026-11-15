import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api } from './api';

/**
 * Exécute `fn` toutes les `ms` millisecondes tant que l'écran est affiché ET l'application au premier plan (actualisation par interrogation :
 * aucun appel en arrière-plan, donc pas de batterie ni de données consommées pour rien). Une première exécution a lieu à l'affichage.
 */
export function usePoll(fn: () => void | Promise<void>, ms: number): void {
  const latest = useRef(fn);
  latest.current = fn;
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null;
      const run = () => {
        void Promise.resolve(latest.current()).catch(() => undefined);
      };
      const start = () => {
        if (!timer) timer = setInterval(run, ms);
      };
      const stop = () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      };
      run();
      start();
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') {
          run();
          start();
        } else stop();
      });
      return () => {
        stop();
        sub.remove();
      };
    }, [ms]),
  );
}

/** Nombre de messages non lus (pastille de l'onglet Messages), actualisé toutes les 20 secondes. */
export function useUnread(enabled = true): number {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!enabled) setTotal(0);
  }, [enabled]);
  usePoll(async () => {
    if (enabled) setTotal((await api.get<{ total: number }>('/threads/unread')).total);
  }, 20_000);
  return total;
}
