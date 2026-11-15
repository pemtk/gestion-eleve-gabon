import type { Message } from '@sge/shared';

/**
 * Fusionne les messages reçus du serveur dans la liste affichée.
 * L'exemplaire du serveur remplace l'exemplaire « en attente » qui porte le même identifiant client ;
 * les messages sont triés par rang (`seq`), ceux qui n'ont pas encore de rang restent en bas.
 */
export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  const rank = (message: Message) => message.seq ?? Number.MAX_SAFE_INTEGER;
  return [...byId.values()].sort((a, b) => rank(a) - rank(b));
}
