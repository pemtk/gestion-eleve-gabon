import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { B, Card, H, Hairline, Loading, Muted, Screen, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { C } from '@/theme';

/** Alertes du parent (absences, retards, notes) et leurs réglages. */
export function AlertsScreen() {
  const { data, error, setData } = useApi<{
    alerts: { icon: string; text: string; when: string; hot: boolean }[];
    prefs: { id: string; label: string; on: boolean }[];
  }>('/me/parent/alerts');
  if (!data) return <Loading error={error} />;
  const toggle = async (id: string) => {
    const prefs = data.prefs.map((p) => (p.id === id ? { ...p, on: !p.on } : p));
    setData({ ...data, prefs });
    await api.put(
      '/me/parent/alert-prefs',
      prefs.map(({ id, on }) => ({ id, on })),
    );
  };
  return (
    <Screen gap={18}>
      <H size={34}>Alertes</H>
      {data.alerts.map((a) => (
        <Card key={a.text} tint={a.hot} style={{ flexDirection: 'row', gap: 12 }}>
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
            <Icon name={a.icon} size={18} color={C.a[700]} />
          </View>
          <View style={{ flex: 1 }}>
            <B size={14.5}>{a.text}</B>
            <Muted size={12}>{a.when}</Muted>
          </View>
        </Card>
      ))}
      <View>
        <H size={22} semi style={{ marginBottom: 4 }}>
          Me prévenir quand…
        </H>
        {data.prefs.map((p) => (
          <View key={p.id}>
            <Hairline />
            <Toggle label={p.label} value={p.on} onChange={() => void toggle(p.id)} />
          </View>
        ))}
      </View>
    </Screen>
  );
}
