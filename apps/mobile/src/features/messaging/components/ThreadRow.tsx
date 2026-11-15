import type { ThreadSummary } from '@sge/shared';
import { View } from 'react-native';
import { Avatar, B, ListRow, Muted } from '@/components/ui';
import { C } from '@/theme';

interface Props {
  thread: ThreadSummary;
  onPress: () => void;
}

/** Une ligne de la liste des conversations : pastille, nom, dernier message et compteur de non-lus. */
export function ThreadRow({ thread, onPress }: Props) {
  const unread = thread.unread > 0;
  return (
    <ListRow onPress={onPress} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <Avatar initials={thread.initials} icon={thread.icon} size={46} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <B semi={unread}>{thread.name}</B>
          <Muted size={12}>{thread.time}</Muted>
        </View>
        <Muted size={12}>{thread.kind}</Muted>
        <B size={13.5} numberOfLines={1} color={unread ? C.text : C.n[700]}>
          {thread.last}
        </B>
      </View>
      {unread && <UnreadCount count={thread.unread} />}
    </ListRow>
  );
}

function UnreadCount({ count }: { count: number }) {
  return (
    <View
      accessibilityLabel={`${count} non lu${count > 1 ? 's' : ''}`}
      style={{
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        paddingHorizontal: 6,
        backgroundColor: C.a[200],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <B size={12} semi color={C.a[800]}>
        {count}
      </B>
    </View>
  );
}
