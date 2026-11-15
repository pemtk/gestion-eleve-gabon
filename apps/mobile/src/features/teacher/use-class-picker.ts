import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useApi } from '@/lib/use-api';
import type { TeacherClass } from './types';

/**
 * Classes de l'enseignant (ses affectations) et choix de la classe active.
 * `?classId=` dans l'adresse force la sélection ; sinon la première classe est choisie.
 */
export function useClassPicker() {
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  const { data: classes, error } = useApi<TeacherClass[]>('/me/teacher/classes');
  const [picked, setPicked] = useState<string | null>(null);
  const selected =
    classes?.find((c) => c.id === (picked ?? classId))?.id ?? classes?.[0]?.id ?? null;
  const current = classes?.find((c) => c.id === selected) ?? null;
  return { classes, current, selected, select: setPicked, error };
}
