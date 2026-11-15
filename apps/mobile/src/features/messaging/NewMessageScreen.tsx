import type { Contact, ThreadSummary } from '@sge/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { B, Avatar, Field, Header, ListRow, Loading, Muted, Screen } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useRolePrefix } from '@/lib/use-role-prefix';
import { C } from '@/theme';

/**
 * Choisir une personne à qui écrire. La liste vient du serveur et ne contient que les contacts
 * autorisés pour ce profil : un élève ne voit que ses enseignants, un parent l'administration et
 * les enseignants de la classe de ses enfants.
 */
export function NewMessageScreen() {
  const router = useRouter();
  const prefix = useRolePrefix();
  const { data, error: loadError, setData } = useApi<Contact[]>('/threads/contacts');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const search = async (text: string) => {
    setQuery(text);
    try {
      setData(await api.get<Contact[]>(`/threads/contacts?q=${encodeURIComponent(text)}`));
    } catch {
      /* on garde la liste affichée */
    }
  };

  const open = async (contact: Contact) => {
    setError(null);
    try {
      const thread = await api.post<ThreadSummary>('/threads', { contact: contact.key });
      router.replace(`${prefix}/thread/${thread.id}` as '/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible d’ouvrir la conversation.');
    }
  };

  if (!data) return <Loading error={loadError} />;
  return (
    <Screen gap={12}>
      <Header title="Nouveau message" />
      <Field
        label="Rechercher une personne"
        value={query}
        onChangeText={search}
        placeholder="Nom"
        autoCapitalize="none"
      />
      {error && <B color={C.a[800]}>{error}</B>}
      {data.map((contact) => (
        <ListRow
          key={contact.key}
          onPress={() => open(contact)}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
        >
          <Avatar
            initials={contact.initials}
            icon={contact.initials ? undefined : 'school'}
            size={44}
          />
          <View style={{ flex: 1 }}>
            <B>{contact.name}</B>
            <Muted size={12}>{contact.label}</Muted>
          </View>
        </ListRow>
      ))}
      {!data.length && <Muted size={14}>Personne à qui écrire pour l’instant.</Muted>}
    </Screen>
  );
}
