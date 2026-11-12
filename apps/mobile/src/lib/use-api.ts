import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from './api';

/** Charge une ressource à chaque affichage de l'écran. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!path) return;
    try { setError(null); setData(await api.get<T>(path)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  }, [path]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return { data, error, loading, reload: load, setData };
}
