import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { formatInt } from '@sge/shared';
import { Icon } from '@/components/icon';
import { B, Bar, Btn, Card, H, Header, Loading, Muted, Num, Screen, Chips } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { C, F, R } from '@/theme';

/** Récompenses fixées par le parent, avec le seuil de points à atteindre (§5.6). */
export function RewardsScreen() {
  const { kid } = useLocalSearchParams<{ kid?: string }>();
  const { data, error, reload } = useApi<{
    child: string | null;
    points: number;
    rewards: { id: string; label: string; threshold: number; reached: boolean; left: number }[];
  }>(kid ? `/me/parent/rewards/${kid}` : '/me/parent/rewards');
  const [label, setLabel] = useState('');
  const [threshold, setThreshold] = useState<string | null>('2000');
  if (!data) return <Loading error={error} />;
  const add = async () => {
    await api.post('/me/parent/rewards', { label, threshold: Number(threshold) });
    setLabel('');
    void reload();
  };
  return (
    <Screen gap={16}>
      <Header title={data.child ? `Récompenses de ${data.child}` : 'Récompenses'} />
      <Card
        tint
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <B color={C.a[800]}>Points actuels</B>
        <Num size={30} color={C.a[800]}>
          {formatInt(data.points)}
        </Num>
      </Card>
      {data.rewards.map((r) => (
        <Card key={r.id} tint={r.reached} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <H size={20} semi>
              {r.label}
            </H>
            <B size={13}>{formatInt(r.threshold)} pts</B>
          </View>
          <Bar pct={(data.points / r.threshold) * 100} />
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name={r.reached ? 'party-popper' : 'target'} size={15} color={C.a[700]} />
            <B size={13} color={C.a[800]}>
              {r.reached
                ? 'Seuil atteint : à vous de jouer !'
                : `Encore ${formatInt(r.left)} points`}
            </B>
          </View>
        </Card>
      ))}
      <Card style={{ gap: 12 }}>
        <H size={20} semi>
          Nouvelle récompense
        </H>
        <TextInput
          accessibilityLabel="Nom de la récompense"
          value={label}
          onChangeText={setLabel}
          placeholder="Ex. Sortie au parc"
          placeholderTextColor={C.n[500]}
          style={{
            minHeight: 52,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: C.divider,
            borderRadius: R.lg,
            fontFamily: F.body,
            fontSize: 16,
            color: C.text,
          }}
        />
        <Chips
          options={['500', '1000', '2000', '3000'].map((n) => ({
            key: n,
            label: formatInt(Number(n)),
          }))}
          value={threshold}
          onChange={setThreshold}
        />
        <Btn icon="plus" label="Ajouter" onPress={add} disabled={!label.trim()} />
        <Muted size={12.5}>
          C’est vous qui offrez la récompense. L’application vous prévient quand le seuil est
          atteint.
        </Muted>
      </Card>
    </Screen>
  );
}
