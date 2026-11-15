import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { B, Bar, Card, H, Kicker, ListRow, Loading, Muted, Pill, Screen } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { C, F, R } from '@/theme';
import type { TeacherClass } from './types';

/** Accueil de l'enseignant : ses classes et ce qui demande son attention. */
export function HomeScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { data: d, error } = useApi<{
    mainClass: TeacherClass | null;
    currentTask: {
      id: string;
      title: string;
      className: string;
      due: string;
      done: number;
      total: number;
      doubts: number;
    } | null;
    classes: TeacherClass[];
  }>('/me/teacher/home');
  const { data: notifs } = useApi<{ read: boolean }[]>('/notifications');
  if (!d) return <Loading error={error} />;
  const cid = d.mainClass?.id ?? '';
  const actions = [
    ['calendar-check', 'Faire l’appel', `/prof/appel?classId=${cid}`],
    ['pen-line', 'Saisir des notes', `/prof/notes?classId=${cid}`],
    ['plus', 'Nouvelle tâche', `/prof/tache?classId=${cid}`],
    ['megaphone', 'Annonce', `/prof/annonce?classId=${cid}`],
  ] as const;
  return (
    <Screen gap={20}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <H size={28}>
            Bonjour{' '}
            <H size={28} italic>
              {user?.name}
            </H>
          </H>
          <Muted size={12.5}>
            {[...new Set(d.classes.map((c) => c.subject))].join(', ') || 'Enseignant'}
          </Muted>
        </View>
        <Pressable
          onPress={() => router.push('/prof/notifications')}
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
          {notifs?.some((n) => !n.read) && (
            <View
              style={{
                position: 'absolute',
                top: 9,
                right: 10,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: C.accent,
              }}
            />
          )}
        </Pressable>
      </View>
      {!d.mainClass ? (
        <Card>
          <B color={C.n[700]}>
            Aucune classe ne vous est encore affectée. Contactez l’administration de l’école.
          </B>
        </Card>
      ) : (
        <Card tint style={{ gap: 12 }}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <View>
              <Kicker>{d.mainClass.principal ? 'Classe principale' : 'Ma première classe'}</Kicker>
              <H size={30}>{d.mainClass.name}</H>
            </View>
            <B color={C.a[800]}>{d.mainClass.students} élèves</B>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {actions.map(([i, l, to]) => (
              <Pressable
                key={l}
                onPress={() => router.push(to)}
                accessibilityRole="button"
                style={{
                  width: '48.5%',
                  minHeight: 52,
                  flexDirection: 'row',
                  gap: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: R.lg,
                  borderWidth: 1,
                  borderColor: C.a[400],
                  backgroundColor: C.bg,
                }}
              >
                <Icon name={i} size={18} color={C.a[800]} />
                <Text style={{ fontFamily: F.headingSemi, fontSize: 16, color: C.a[800] }}>
                  {l}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => router.push(`/prof/codes?classId=${cid}`)}
            accessibilityRole="button"
            style={{ minHeight: 48, flexDirection: 'row', gap: 10, alignItems: 'center' }}
          >
            <Icon name="qr-code" size={19} color={C.a[800]} />
            <B size={14} color={C.a[800]} style={{ flex: 1 }}>
              Codes d’invitation des parents
            </B>
            <Icon name="chevron-right" size={18} color={C.a[800]} />
          </Pressable>
        </Card>
      )}
      {d.currentTask && (
        <View style={{ gap: 10 }}>
          <H size={22} semi>
            Dernière tâche publiée
          </H>
          <ListRow
            onPress={() => router.push(`/prof/suivi?task=${d.currentTask!.id}`)}
            style={{ gap: 8 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Pill label={d.currentTask.className} />
              <Muted size={12}>{d.currentTask.due}</Muted>
            </View>
            <H size={19} semi>
              {d.currentTask.title}
            </H>
            <Bar pct={d.currentTask.total ? (d.currentTask.done / d.currentTask.total) * 100 : 0} />
            <Muted size={12.5}>
              {d.currentTask.done}/{d.currentTask.total} terminé
            </Muted>
            {d.currentTask.doubts > 0 && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Icon name="circle-help" size={15} color={C.a[700]} />
                <B size={13} color={C.a[800]}>
                  {d.currentTask.doubts} élève{d.currentTask.doubts > 1 ? 's ont' : ' a'} des doutes
                </B>
              </View>
            )}
          </ListRow>
        </View>
      )}
      <View style={{ gap: 10 }}>
        <H size={22} semi>
          Mes classes
        </H>
        {d.classes.map((c) => (
          <Card key={c.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <H size={20} semi>
                {c.name}
              </H>
              <Muted>
                {c.students} élèves · {c.subject}
              </Muted>
            </View>
            <Bar pct={c.pct} />
            <Muted size={12.5}>{c.pct} % des tâches faites</Muted>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
