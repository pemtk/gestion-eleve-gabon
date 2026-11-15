import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { formatGrade, formatInt } from '@sge/shared';
import { Icon } from '@/components/icon';
import {
  Avatar,
  B,
  Bar,
  Btn,
  Card,
  H,
  Loading,
  Muted,
  Num,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { C } from '@/theme';
import type { Kid } from './types';

/** Activité d'un enfant : tâches, résultats, absences et temps de travail. */
export function ActivityScreen() {
  const router = useRouter();
  const { kid } = useLocalSearchParams<{ kid?: string }>();
  // Sans enfant choisi (onglet « Activité »), on prend le premier enfant rattaché.
  const kids = useApi<Kid[]>('/me/parent/children');
  const id = kid ?? kids.data?.[0]?.id ?? null;
  const { data: d, error } = useApi<{
    kid: { id: string; name: string; initials: string; className: string; school: string };
    stats: { icon: string; value: string; label: string }[];
    week: { day: string; minutes: number }[];
    weekTotalLabel: string;
    reward: { label: string; threshold: number; points: number; left: number } | null;
    lastGrades: { subject: string; value: number }[];
  }>(id ? `/me/parent/children/${id}` : null);
  if (kids.data && !kids.data.length) {
    return (
      <Screen gap={16}>
        <H size={34}>Activité</H>
        <B color={C.n[700]}>Aucun enfant n’est encore rattaché à votre compte.</B>
        <Btn
          icon="qr-code"
          label="Ajouter un enfant"
          onPress={() => router.push('/parent/ajouter')}
        />
      </Screen>
    );
  }
  if (!d) return <Loading error={error ?? kids.error} />;
  const max = Math.max(...d.week.map((w) => w.minutes), 1);
  return (
    <Screen gap={18}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar initials={d.kid.initials} size={44} />
        <View>
          <H size={22} semi>
            {d.kid.name}
          </H>
          <Muted size={12.5}>
            {d.kid.className} · {d.kid.school}
          </Muted>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {d.stats.map((s) => (
          <Card key={s.label} style={{ width: '48%', gap: 2 }}>
            <Icon name={s.icon} size={18} color={C.a[700]} />
            <Num size={30}>{s.value}</Num>
            <Muted size={12.5}>{s.label}</Muted>
          </Card>
        ))}
      </View>
      <View style={{ gap: 12 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <H size={22} semi>
            Temps de travail
          </H>
          <Muted size={12.5}>cette semaine · {d.weekTotalLabel}</Muted>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            height: 110,
            borderBottomWidth: 1,
            borderBottomColor: C.divider,
          }}
        >
          {d.week.map((w, i) => (
            <View
              key={i}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}
            >
              <View
                accessibilityLabel={`${w.day} : ${w.minutes} minutes`}
                style={{
                  width: '100%',
                  maxWidth: 26,
                  height: `${Math.round((w.minutes / max) * 100)}%`,
                  minHeight: 2,
                  backgroundColor: w.minutes > 60 ? C.a[300] : C.a[100],
                  borderWidth: 1,
                  borderColor: C.a[400],
                  borderBottomWidth: 0,
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {d.week.map((w, i) => (
            <Muted key={i} size={11.5} style={{ flex: 1, textAlign: 'center' }}>
              {w.day}
            </Muted>
          ))}
        </View>
      </View>
      {d.reward && (
        <View style={{ gap: 8 }}>
          <SectionTitle
            title="Récompense"
            action="Gérer les récompenses"
            onAction={() => router.push(`/parent/recompenses?kid=${d.kid.id}`)}
          />
          <Card tint style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <H size={21} italic>
                {d.reward.label}
              </H>
              <B size={13} color={C.a[800]}>
                {formatInt(d.reward.points)} / {formatInt(d.reward.threshold)}
              </B>
            </View>
            <Bar pct={(d.reward.points / d.reward.threshold) * 100} />
            <B size={13} color={C.a[800]}>
              Plus que {formatInt(d.reward.left)} points. Nous vous préviendrons.
            </B>
          </Card>
        </View>
      )}
      <View>
        <H size={22} semi style={{ marginBottom: 6 }}>
          Dernières notes
        </H>
        {d.lastGrades.map((g) => (
          <View
            key={g.subject}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: C.divider,
            }}
          >
            <B style={{ flex: 1 }}>{g.subject}</B>
            <Num size={26}>
              {formatGrade(g.value)}
              <Text style={{ fontSize: 14, color: C.n[600] }}>/20</Text>
            </Num>
          </View>
        ))}
      </View>
      <Btn
        icon="message-circle"
        label="Écrire à l’enseignant"
        onPress={() => router.push('/parent/messages')}
      />
    </Screen>
  );
}
