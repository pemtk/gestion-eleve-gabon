import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { formatInt } from '@/lib/format';
import { Icon } from '@/components/icon';
import { B, Btn, Card, H, Muted, Num, Screen } from '@/components/ui';
import { C } from '@/theme';

/** Écran de félicitations après la validation d'une tâche (points, série). */
export function CelebrationScreen() {
  const p = useLocalSearchParams<{
    gained: string;
    points: string;
    streak: string;
    badges?: string;
    queued?: string;
    note?: string;
  }>();
  const router = useRouter();
  return (
    <Screen gap={18}>
      <View style={{ alignItems: 'center', gap: 18, paddingTop: 30 }}>
        <View
          style={{
            width: 132,
            height: 132,
            borderRadius: 66,
            borderWidth: 1.5,
            borderColor: C.accent,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: C.a[300],
            shadowOpacity: 1,
            shadowRadius: 0,
          }}
        >
          <Icon name="trophy" size={54} color={C.a[700]} />
        </View>
        <Num size={64} color={C.a[800]}>
          +{p.gained}
        </Num>
        <H size={28}>Bravo, tâche terminée !</H>
        <B color={C.n[700]} style={{ textAlign: 'center' }}>
          {p.queued ? 'Enregistré sur ton téléphone : il partira dès le retour du réseau.' : p.note}
        </B>
        {p.points ? (
          <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
            <Card style={{ flex: 1 }}>
              <Num size={26}>{formatInt(Number(p.points))}</Num>
              <Muted size={12}>points</Muted>
            </Card>
            <Card style={{ flex: 1 }}>
              <Num size={26}>{p.streak} j</Num>
              <Muted size={12}>de série</Muted>
            </Card>
          </View>
        ) : null}
        {p.badges ? (
          <Card tint style={{ width: '100%', gap: 6 }}>
            <Muted size={12}>Nouveau badge</Muted>
            {p.badges.split('|').map((label) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="award" size={20} color={C.a[700]} />
                <B>{label}</B>
              </View>
            ))}
          </Card>
        ) : null}
        <Btn label="Retour à l’accueil" onPress={() => router.replace('/eleve')} />
      </View>
    </Screen>
  );
}
