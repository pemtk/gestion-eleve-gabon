import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/icon';
import { RemoteImage } from '@/components/remote-image';
import {
  Avatar,
  B,
  Btn,
  Card,
  Header,
  Loading,
  Muted,
  Num,
  Pill,
  Screen,
  Seg,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { C } from '@/theme';
import { errorMessage } from './format';
import { ErrorNote, SuccessNote } from './components/Notices';

/** Suivi d'une tâche : qui l'a faite, qui a des doutes, invalider ou signaler. */
export function FollowUpScreen() {
  const router = useRouter();
  const { task } = useLocalSearchParams<{ task?: string }>();
  const list = useApi<{ id: string }[]>('/me/teacher/tasks');
  const id = task ?? list.data?.[0]?.id ?? null;
  const { data, error, reload } = useApi<{
    task: { id: string; title: string; due: string; className: string };
    rows: StudentFollowUp[];
    doubts: number;
  }>(id ? `/me/teacher/tasks/${id}/follow-up` : null);
  const [f, setF] = useState<'all' | 'doubt' | 'todo'>('all');
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  if (list.data && !list.data.length && !task)
    return (
      <Screen>
        <Header title="Suivi des tâches" />
        <B color={C.n[700]}>Vous n’avez pas encore publié de tâche.</B>
        <Btn label="Nouvelle tâche" icon="plus" onPress={() => router.push('/prof/tache')} />
      </Screen>
    );
  if (!data) return <Loading error={error ?? list.error} />;
  const rows = data.rows.filter(
    (r) =>
      f === 'all' ||
      (f === 'doubt' ? r.evaluation === 'doubt' : r.status === 'none' || r.status === 'redo'),
  );
  const cnt = (s: StudentFollowUp['status'][]) =>
    data.rows.filter((r) => s.includes(r.status)).length;
  const invalidate = async (r: StudentFollowUp) => {
    setProblem(null);
    try {
      await api.post(`/me/teacher/tasks/${data.task.id}/invalidate/${r.studentId}`);
      setNote(`Tâche renvoyée à ${r.name.split(' ')[0]}. Les points sont annulés.`);
      void reload();
    } catch (e) {
      setProblem(errorMessage(e, 'Invalidation impossible.'));
    }
  };
  return (
    <Screen gap={14}>
      <Header
        title={data.task.title}
        sub={`${data.task.className} · à rendre ${data.task.due.toLowerCase()}`}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(
          [
            ['done', 'terminé', ['done']],
            ['doing', 'en cours', ['doing']],
            ['none', 'pas commencé', ['none', 'redo']],
          ] as const
        ).map(([k, l, st]) => (
          <Card key={k} style={{ flex: 1, alignItems: 'center', padding: 10 }}>
            <Num size={28}>{cnt([...st])}</Num>
            <Muted size={11.5}>{l}</Muted>
          </Card>
        ))}
      </View>
      {data.doubts > 0 && (
        <Card tint style={{ flexDirection: 'row', gap: 10 }}>
          <Icon name="circle-help" size={18} color={C.a[800]} />
          <B size={13.5} color={C.a[800]} style={{ flex: 1 }}>
            {data.doubts} élève{data.doubts > 1 ? 's ont' : ' a'} des doutes sur cette tâche.
          </B>
        </Card>
      )}
      <Seg
        value={f}
        onChange={setF}
        options={[
          { key: 'all', label: 'Tous' },
          { key: 'doubt', label: 'Doutes' },
          { key: 'todo', label: 'À relancer' },
        ]}
      />
      {note && <SuccessNote text={note} />}
      <ErrorNote text={problem} />
      {rows.map((r) => (
        <Card key={r.studentId} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar initials={r.initials} size={38} />
            <B style={{ flex: 1 }}>{r.name}</B>
            {r.evaluation !== '' && (
              <Icon
                name={r.evaluation === 'ok' ? 'smile' : 'circle-help'}
                size={18}
                color={C.a[700]}
              />
            )}
            {r.proof && r.proofFileId && (
              <Pressable
                onPress={() => setShown(shown === r.proofFileId ? null : r.proofFileId)}
                accessibilityRole="button"
                accessibilityLabel={`Photo de ${r.name}`}
                hitSlop={10}
              >
                <Icon name="camera" size={18} color={C.a[700]} />
              </Pressable>
            )}
          </View>
          {r.proofFileId && shown === r.proofFileId && (
            <RemoteImage
              fileId={r.proofFileId}
              size={260}
              style={{ alignSelf: 'center', width: '100%', maxWidth: 360, height: 260 }}
            />
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Pill label={SV_LABEL[r.status]} />
            <Muted size={12}>{r.time}</Muted>
            <View style={{ flex: 1 }} />
            {r.status === 'done' && (
              <Btn variant="link" label="Invalider" onPress={() => invalidate(r)} />
            )}
            <Btn
              variant="link"
              label="Signaler"
              onPress={() =>
                router.push({
                  pathname: '/prof/signaler',
                  params: { student: r.name, studentId: r.studentId },
                })
              }
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

type StudentFollowUp = {
  studentId: string;
  name: string;
  initials: string;
  status: 'done' | 'doing' | 'none' | 'redo';
  time: string;
  evaluation: '' | 'ok' | 'doubt';
  proof: boolean;
  proofFileId: string | null;
};

const SV_LABEL = { done: 'Terminé', doing: 'En cours', none: 'Pas commencé', redo: 'À refaire' };
