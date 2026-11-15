import { View } from 'react-native';
import { Chips, Muted } from '@/components/ui';
import type { TeacherClass } from '../types';

interface Props {
  classes: TeacherClass[] | null | undefined;
  selected: string | null;
  onSelect: (classId: string) => void;
}

/** Sélecteur de classe, affiché seulement quand l'enseignant en a plusieurs. */
export function ClassPicker({ classes, selected, onSelect }: Props) {
  if (!classes || classes.length < 2) return null;
  return (
    <View style={{ gap: 8 }}>
      <Muted size={13}>Classe</Muted>
      <Chips
        options={classes.map((c) => ({ key: c.id, label: c.name }))}
        value={selected}
        onChange={onSelect}
      />
    </View>
  );
}
