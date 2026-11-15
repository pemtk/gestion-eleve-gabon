import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { Avatar, B, Btn, Card, H, ListRow, Loading, Muted, Screen } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { C } from '@/theme';
import type { Kid } from './types';

/** Accueil du parent : ses enfants et l'essentiel de leur journée. */
export function HomeScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { data, error } = useApi<Kid[]>('/me/parent/children');
  if (!data) return <Loading error={error} />;
  return (
    <Screen gap={20}>
      <View>
        <H size={32}>
          Bonjour{' '}
          <H size={32} italic>
            {user?.name.split(' ').slice(-2).join(' ')}
          </H>
        </H>
        <B color={C.n[700]} style={{ marginTop: 6 }}>
          Voici vos enfants aujourd’hui.
        </B>
      </View>
      {data.map((k) => (
        <ListRow
          key={k.id}
          onPress={() => router.push(`/parent/activite?kid=${k.id}`)}
          style={{ padding: 0, overflow: 'hidden' }}
        >
          <View style={{ padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Avatar initials={k.initials} size={54} />
            <View style={{ flex: 1 }}>
              <H size={22} semi>
                {k.name}
              </H>
              <Muted>{k.className}</Muted>
            </View>
            <Icon name="chevron-right" size={22} color={C.n[500]} />
          </View>
          <View
            style={{
              padding: 13,
              paddingHorizontal: 16,
              borderTopWidth: 1,
              borderTopColor: C.divider,
              backgroundColor: k.alert ? C.a[100] : 'transparent',
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <Icon name={k.icon} size={20} color={k.alert ? C.a[800] : C.a[700]} />
            <B size={15} color={k.alert ? C.a[800] : C.text} style={{ flex: 1 }}>
              {k.status}
            </B>
          </View>
        </ListRow>
      ))}
      <Btn
        variant="secondary"
        icon="qr-code"
        label="Ajouter un enfant"
        onPress={() => router.push('/parent/ajouter')}
        style={{ borderStyle: 'dashed', borderColor: C.accent }}
      />
      <View style={{ gap: 10 }}>
        <H size={22} semi>
          Messages de l’école
        </H>
        <Card style={{ flexDirection: 'row', gap: 12 }}>
          <Icon name="megaphone" size={20} color={C.a[700]} />
          <View style={{ flex: 1 }}>
            <Muted size={12}>M. Ndong · 3ème B · il y a 2 h</Muted>
            <B size={14.5}>
              Demain, évaluation de mathématiques sur le chapitre 3. Pensez à réviser.
            </B>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
