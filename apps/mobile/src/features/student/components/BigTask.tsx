import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { H, ListRow, Muted, Pill } from '@/components/ui';
import { C } from '@/theme';
import type { Task } from '../types';

/** Carte d'une tâche dans la liste complète. */
export function BigTask({ task }: { task: Task }) {
  const router = useRouter();
  return (
    <ListRow onPress={() => router.push(`/eleve/tache/${task.id}`)} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pill label={task.type} />
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
          <Icon name="calendar" size={13} color={C.n[700]} />
          <Muted size={12}>{task.due}</Muted>
        </View>
      </View>
      <H size={19} semi>
        {task.title}
      </H>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Muted size={12.5}>{task.subject}</Muted>
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
          <Icon name="timer" size={13} color={C.n[700]} />
          <Muted size={12.5}>≈ {task.estimate}</Muted>
        </View>
      </View>
    </ListRow>
  );
}
