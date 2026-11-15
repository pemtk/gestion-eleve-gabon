import type { ThreadSummary } from '@sge/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Btn, H, Loading, Muted, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { usePoll } from '@/lib/use-poll';
import { useRolePrefix } from '@/lib/use-role-prefix';
import { C, F, R } from '@/theme';
import { ThreadRow } from './components/ThreadRow';

const REFRESH_EVERY_MS = 10_000;

/** Liste des conversations, actualisée toutes les 10 secondes, avec recherche par nom. */
export function MessagesScreen() {
  const router = useRouter();
  const prefix = useRolePrefix();
  const { data, error, setData } = useApi<ThreadSummary[]>('/threads');
  const [filter, setFilter] = useState('');
  usePoll(async () => setData(await api.get<ThreadSummary[]>('/threads')), REFRESH_EVERY_MS);

  if (!data) return <Loading error={error} />;
  const needle = filter.trim().toLowerCase();
  const shown = data.filter((thread) => thread.name.toLowerCase().includes(needle));

  return (
    <Screen gap={14}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <H size={34}>Messages</H>
        <Btn
          variant="secondary"
          size="md"
          label="Nouveau"
          icon="plus"
          onPress={() => router.push(`${prefix}/nouveau-message` as '/')}
        />
      </View>
      <SearchField value={filter} onChange={setFilter} />
      {shown.map((thread) => (
        <ThreadRow
          key={thread.id}
          thread={thread}
          onPress={() => router.push(`${prefix}/thread/${thread.id}` as '/')}
        />
      ))}
      {!shown.length && (
        <Muted size={14}>
          {data.length
            ? 'Aucune conversation ne correspond.'
            : 'Aucune conversation pour l’instant. Touchez « Nouveau » pour écrire à quelqu’un.'}
        </Muted>
      )}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon name="info" size={15} color={C.n[600]} />
        <Muted size={12}>Vous pouvez envoyer du texte et une image par message.</Muted>
      </View>
    </Screen>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        minHeight: 46,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: C.divider,
        borderRadius: R.lg,
      }}
    >
      <Icon name="search" size={17} color={C.n[600]} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Rechercher une conversation"
        placeholderTextColor={C.n[500]}
        accessibilityLabel="Rechercher une conversation"
        style={{ flex: 1, minHeight: 44, fontFamily: F.body, fontSize: 14.5, color: C.text }}
      />
    </View>
  );
}
