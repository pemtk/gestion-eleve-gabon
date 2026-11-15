import type { Message, ThreadSummary } from '@sge/shared';
import { useCallback, useRef, useState } from 'react';
import { api, NetworkError } from '@/lib/api';
import { pickPhoto, uploadPhoto } from '@/lib/files';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { usePoll } from '@/lib/use-poll';
import { mergeMessages } from './merge-messages';

const REFRESH_EVERY_MS = 4_000;

/** Message prêt à partir : du texte, une image déjà envoyée, ou les deux. */
type Outgoing = { text?: string; fileId?: string };

const newClientId = () => `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const nowLabel = () =>
  new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * Logique d'une conversation, séparée de son affichage : chargement, actualisation par interrogation,
 * marquage « lu », envoi (texte ou image) avec file d'attente hors ligne.
 */
export function useThread(id: string) {
  const { send, offline } = useSession();
  const { data: summary } = useApi<ThreadSummary>(`/threads/${id}`);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastSeq = useRef(0);

  // Seuls les messages plus récents que le dernier reçu sont demandés, puis le fil est marqué lu.
  const refresh = useCallback(async () => {
    try {
      const fresh = await api.get<Message[]>(`/threads/${id}/messages?after=${lastSeq.current}`);
      setMessages((current) => mergeMessages(current ?? [], fresh));
      if (fresh.length)
        lastSeq.current = Math.max(lastSeq.current, ...fresh.map((m) => m.seq ?? 0));
      if (fresh.length || lastSeq.current === 0) await api.post(`/threads/${id}/read`, {});
    } catch (e) {
      if (!(e instanceof NetworkError)) setError(e instanceof Error ? e.message : 'Erreur');
    }
  }, [id]);
  usePoll(refresh, REFRESH_EVERY_MS);

  const submit = async (outgoing: Outgoing): Promise<boolean> => {
    const clientId = newClientId();
    const pending: Message = {
      id: clientId,
      mine: true,
      text: outgoing.text ?? null,
      image: outgoing.fileId ? true : undefined,
      fileId: outgoing.fileId,
      time: nowLabel(),
      pending: true,
    };
    try {
      const res = await send<Message>('POST', `/threads/${id}/messages`, { ...outgoing, clientId });
      const shown = res.queued || !res.data ? pending : res.data;
      setMessages((current) => mergeMessages(current ?? [], [shown]));
      if (res.data?.seq) lastSeq.current = Math.max(lastSeq.current, res.data.seq);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.');
      return false;
    }
  };

  const sendText = async (text: string): Promise<boolean> => {
    if (!text.trim() || busy) return false;
    setBusy(true);
    const sent = await submit({ text: text.trim() });
    setBusy(false);
    return sent;
  };

  const sendImage = async () => {
    if (busy) return;
    setError(null);
    try {
      if (offline) throw new Error('Pas de réseau : l’image ne peut pas être envoyée maintenant.');
      const photo = await pickPhoto('library');
      if (!photo) return;
      setBusy(true);
      await submit({ fileId: await uploadPhoto('message', photo) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image impossible.');
    } finally {
      setBusy(false);
    }
  };

  return { summary, messages, error, busy, sendText, sendImage };
}
