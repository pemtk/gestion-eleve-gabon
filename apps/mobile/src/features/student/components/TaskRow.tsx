import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { B, ListRow, Muted, Pill } from '@/components/ui';
import { C } from '@/theme';
import type { Task } from '../types';

/** Ligne d'une tâche sur l'accueil : état, titre, type, matière et échéance. */
export function TaskRow({ task }: { task: Task }) {
  const router = useRouter();
  const done = task.status === 'done';
  return (
    <ListRow
      onPress={() => router.push(`/eleve/tache/${task.id}`)}
      style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          borderWidth: 1.5,
          borderColor: task.status === 'todo' ? C.n[400] : C.accent,
          backgroundColor: done ? C.a[200] : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {TASK_ICON[task.status] ? (
          <Icon name={TASK_ICON[task.status]} size={15} color={C.a[800]} />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 4, opacity: done ? 0.55 : 1 }}>
        <B style={{ textDecorationLine: done ? 'line-through' : 'none' }}>{task.title}</B>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill label={task.type} />
          <Muted size={12}>
            {task.subject} · {task.due}
          </Muted>
        </View>
      </View>
      <Icon name="chevron-right" size={18} color={C.n[500]} />
    </ListRow>
  );
}

const TASK_ICON = { todo: '', doing: 'clock', done: 'check' } as const;
