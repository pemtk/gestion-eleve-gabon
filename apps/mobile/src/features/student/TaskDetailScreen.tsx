import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { formatTimer } from '@/lib/format';
import { Icon } from '@/components/icon';
import { B, Btn, Card, H, Header, Loading, Muted, Num, Pill, Ring, Screen } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { C, R } from '@/theme';
import type { Task } from './types';

/** §4.3 — lire la consigne, lancer le minuteur, mettre en pause, terminer. */
export function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: t, error } = useApi<
    Task & {
      teacher: string;
      instructions: string;
      resources: { kind: string; label: string; meta: string }[];
    }
  >(`/me/student/tasks/${id}`);
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [running]);
  if (!t) return <Loading error={error} />;
  return (
    <Screen gap={16}>
      <Header title="" right={<Pill label={`${t.type} · ${t.subject}`} />} />
      <H size={30} style={{ lineHeight: 33 }}>
        {t.title}
      </H>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
        {[
          ['user', t.teacher],
          ['calendar', t.due],
          ['timer', `≈ ${t.estimate}`],
        ].map(([i, l]) => (
          <View key={l} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
            <Icon name={i!} size={14} color={C.n[700]} />
            <Muted size={12.5}>{l}</Muted>
          </View>
        ))}
      </View>
      <B size={14.5}>{t.instructions}</B>
      {t.resources.map((r) => (
        <View
          key={r.label}
          style={{
            flexDirection: 'row',
            gap: 12,
            alignItems: 'center',
            padding: 12,
            borderWidth: 1,
            borderColor: C.divider,
            borderRadius: R.lg,
          }}
        >
          <Icon name={r.kind === 'pdf' ? 'file-text' : 'circle-play'} size={20} color={C.a[700]} />
          <View style={{ flex: 1 }}>
            <B size={14}>{r.label}</B>
            <Muted size={12}>{r.meta}</Muted>
          </View>
          <Icon name={r.kind === 'pdf' ? 'download' : 'external-link'} size={18} color={C.n[600]} />
        </View>
      ))}
      <Card style={{ alignItems: 'center', gap: 16, paddingVertical: 20 }}>
        <Ring size={176} stroke={6} pct={sec / 1800}>
          <Num size={50}>{formatTimer(sec)}</Num>
          <Muted size={12}>
            {!started ? 'prêt à démarrer' : running ? 'au travail' : 'en pause'}
          </Muted>
        </Ring>
        {!started ? (
          <Btn
            label="Démarrer le travail"
            icon="play"
            onPress={() => {
              setStarted(true);
              setRunning(true);
            }}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
            <View style={{ flex: 1 }}>
              <Btn
                variant="secondary"
                label={running ? 'Pause' : 'Reprendre'}
                icon={running ? 'pause' : 'play'}
                onPress={() => setRunning((r) => !r)}
              />
            </View>
            <View style={{ flex: 1.4 }}>
              <Btn
                label="J’ai terminé"
                icon="check"
                onPress={() =>
                  router.push({
                    pathname: '/eleve/autoeval',
                    params: { id: t.id, sec: String(sec), title: t.title },
                  })
                }
              />
            </View>
          </View>
        )}
        <Muted size={12} style={{ textAlign: 'center' }}>
          Prends le temps qu’il faut : une tâche bouclée trop vite peut être refusée par
          l’enseignant.
        </Muted>
      </Card>
    </Screen>
  );
}
