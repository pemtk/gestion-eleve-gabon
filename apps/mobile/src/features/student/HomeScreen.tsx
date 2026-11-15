import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { formatGrade, formatInt } from '@/lib/format';
import { Icon } from '@/components/icon';
import {
  Avatar,
  B,
  H,
  Kicker,
  Loading,
  Muted,
  Num,
  Ring,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { useSession } from '@/lib/session';
import { C, R } from '@/theme';
import type { Task } from './types';
import { TaskRow } from './components/TaskRow';

/** Accueil de l'élève : tâches du jour, série et points. */
export function HomeScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { data: d, error } = useApi<{
    points: number;
    streak: number;
    doneToday: number;
    dailyGoal: number;
    todayTasks: Task[];
    lastGrades: { subject: string; value: number; comment: string }[];
  }>('/me/student/home');
  const { data: notifs } = useApi<{ read: boolean }[]>('/notifications');
  if (!d) return <Loading error={error} />;
  const unread = notifs?.some((n) => !n.read);
  return (
    <Screen gap={22}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar initials={user?.initials} />
        <View style={{ flex: 1 }}>
          <H size={28}>
            Bonjour{' '}
            <H size={28} italic>
              {user?.name.split(' ')[0]}
            </H>
          </H>
          <Muted size={12.5}>3ème B{user?.organization ? ` · ${user.organization}` : ''}</Muted>
        </View>
        <Pressable
          onPress={() => router.push('/eleve/notifications')}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: C.divider,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="bell" size={19} />
          {unread && (
            <View
              style={{
                position: 'absolute',
                top: 9,
                right: 10,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: C.accent,
                borderWidth: 2,
                borderColor: C.bg,
              }}
            />
          )}
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push('/eleve/trophees')}
        accessibilityRole="button"
        accessibilityLabel="Mes points"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          padding: 18,
          borderRadius: R.lg,
          backgroundColor: C.a[100],
          borderWidth: 1,
          borderColor: C.a[300],
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Kicker>Mes points</Kicker>
          <Num size={46} color={C.a[800]}>
            {formatInt(d.points)}
          </Num>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 }}>
            <Icon name="flame" size={16} color={C.a[800]} />
            <B size={13} color={C.a[800]}>
              Série de {d.streak} jours
            </B>
          </View>
        </View>
        <Ring pct={d.doneToday / d.dailyGoal}>
          <Num size={24}>
            {d.doneToday}/{d.dailyGoal}
          </Num>
          <B size={10} color={C.a[800]}>
            aujourd’hui
          </B>
        </Ring>
      </Pressable>
      <View style={{ gap: 10 }}>
        <SectionTitle
          title="Aujourd’hui"
          action="Toutes mes tâches"
          onAction={() => router.push('/eleve/taches')}
        />
        {d.todayTasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <SectionTitle
          title="Dernières notes"
          action="Tous mes résultats"
          onAction={() => router.push('/eleve/resultats')}
        />
        <View style={{ borderTopWidth: 1, borderTopColor: C.divider }}>
          {d.lastGrades.map((g) => (
            <View
              key={g.subject}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: C.divider,
              }}
            >
              <View style={{ flex: 1 }}>
                <B>{g.subject}</B>
                <B size={12.5} italic color={C.n[700]}>
                  « {g.comment} »
                </B>
              </View>
              <Num size={28}>
                {formatGrade(g.value)}
                <Text style={{ fontSize: 15, color: C.n[600] }}>/20</Text>
              </Num>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}
