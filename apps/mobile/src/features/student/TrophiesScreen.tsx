import { Text, View } from 'react-native';
import type { Badge } from '@sge/shared';
import { formatInt } from '@/lib/format';
import { Icon } from '@/components/icon';
import {
  B,
  Card,
  Header,
  Kicker,
  Loading,
  Muted,
  Num,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { C, F } from '@/theme';

/** Points, série de jours et badges de l'élève. */
export function TrophiesScreen() {
  const { data: d, error } = useApi<{
    points: number;
    streak: number;
    badges: Badge[];
    history: { label: string; when: string; points: string }[];
  }>('/me/student/trophies');
  if (!d) return <Loading error={error} />;
  return (
    <Screen gap={20}>
      <Header title="Mes trophées" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card tint style={{ flex: 1 }}>
          <Kicker>Total</Kicker>
          <Num size={40} color={C.a[800]}>
            {formatInt(d.points)}
          </Num>
        </Card>
        <Card style={{ flex: 1 }}>
          <Kicker>Série</Kicker>
          <Num size={40}>
            {d.streak} <Text style={{ fontSize: 18 }}>jours</Text>
          </Num>
        </Card>
      </View>
      <SectionTitle title="Badges" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
        {d.badges.map((b) => (
          <View
            key={b.id}
            accessibilityLabel={`${b.label} : ${b.earned ? 'obtenu' : `${b.progress.value} sur ${b.progress.target}`}. ${b.description}`}
            style={{ width: '33.33%', alignItems: 'center', gap: 7, opacity: b.earned ? 1 : 0.5 }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                borderWidth: 1.5,
                borderColor: C.accent,
                backgroundColor: b.earned ? C.a[100] : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={b.icon} size={26} color={C.a[700]} />
            </View>
            <B size={12} style={{ textAlign: 'center' }}>
              {b.label}
            </B>
            <Muted size={11} style={{ textAlign: 'center' }}>
              {b.earned ? 'Obtenu' : `${b.progress.value} / ${b.progress.target}`}
            </Muted>
          </View>
        ))}
      </View>
      <SectionTitle title="Historique" />
      {d.history.map((h, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 11,
            borderBottomWidth: 1,
            borderBottomColor: C.divider,
          }}
        >
          <View style={{ flex: 1 }}>
            <B size={14}>{h.label}</B>
            <Muted size={12}>{h.when}</Muted>
          </View>
          <Text style={{ fontFamily: F.heading, fontSize: 20, color: C.a[800] }}>{h.points}</Text>
        </View>
      ))}
    </Screen>
  );
}
