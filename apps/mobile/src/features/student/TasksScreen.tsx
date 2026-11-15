import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { B, H, Loading, Screen } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { C, R } from '@/theme';
import type { Task } from './types';
import { BigTask } from './components/BigTask';

/** Toutes les tâches de la classe, filtrées par état. */
export function TasksScreen() {
  const [f, setF] = useState<'todo' | 'doing' | 'done'>('todo');
  const { data, error } = useApi<{ counts: Record<string, number>; tasks: Task[] }>(
    '/me/student/tasks',
  );
  if (!data) return <Loading error={error} />;
  const list = data.tasks.filter((t) => t.status === f);
  return (
    <Screen gap={16}>
      <H size={34}>Mes tâches</H>
      <View
        style={{
          flexDirection: 'row',
          borderWidth: 1,
          borderColor: C.divider,
          borderRadius: R.lg,
          overflow: 'hidden',
        }}
      >
        {FILTERS.map((o, i) => (
          <Pressable
            key={o.key}
            onPress={() => setF(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: f === o.key }}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: f === o.key ? C.a[100] : 'transparent',
              borderLeftWidth: i ? 1 : 0,
              borderLeftColor: C.divider,
            }}
          >
            <B size={13.5} color={f === o.key ? C.a[800] : C.text}>
              {o.label}{' '}
              <B size={13.5} color={C.n[600]}>
                {data.counts[o.key]}
              </B>
            </B>
          </Pressable>
        ))}
      </View>
      {list.map((t) => (
        <BigTask key={t.id} task={t} />
      ))}
      {!list.length && (
        <H size={20} italic color={C.n[600]} style={{ textAlign: 'center', padding: 30 }}>
          Rien ici pour l’instant.
        </H>
      )}
    </Screen>
  );
}

const FILTERS = [
  { key: 'todo', label: 'À faire' },
  { key: 'doing', label: 'En cours' },
  { key: 'done', label: 'Terminées' },
] as const;
