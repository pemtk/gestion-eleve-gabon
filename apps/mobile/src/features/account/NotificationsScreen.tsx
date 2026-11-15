import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { B, Btn, Header, ListRow, Muted, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useRolePrefix } from '@/lib/use-role-prefix';
import { C } from '@/theme';

/* ---------------- Notifications (§3.2) ---------------- */
export function NotificationsScreen() {
  const router = useRouter();
  const prefix = useRolePrefix();
  const { data, reload } =
    useApi<
      { id: string; icon: string; text: string; when: string; target: string; read: boolean }[]
    >('/notifications');
  const open = (target: string) =>
    router.push(`${prefix}${target.replace('/taches/', '/tache/')}` as '/');
  return (
    <Screen gap={12}>
      <Header
        title="Notifications"
        right={
          <Btn
            variant="link"
            label="Tout marquer comme lu"
            onPress={async () => {
              await api.post('/notifications/read-all');
              void reload();
            }}
          />
        }
      />
      {(data ?? []).map((n) => (
        <ListRow
          key={n.id}
          onPress={() => open(n.target)}
          style={{
            flexDirection: 'row',
            gap: 12,
            alignItems: 'center',
            backgroundColor: n.read ? 'transparent' : C.a[100],
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: C.a[400],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={n.icon} size={18} color={C.a[700]} />
          </View>
          <View style={{ flex: 1 }}>
            <B size={14.5}>{n.text}</B>
            <Muted size={12}>{n.when}</Muted>
          </View>
          {!n.read && (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent }} />
          )}
        </ListRow>
      ))}
    </Screen>
  );
}
