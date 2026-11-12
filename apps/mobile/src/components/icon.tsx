import { Circle } from 'lucide-react-native';
import { C } from '@/theme';
import { ICONS, type IconName } from './icons.generated';

/** Icône Lucide désignée par son nom (celui du design). */
export function Icon({ name, size = 18, color = C.text }: { name: string; size?: number; color?: string }) {
  const Cmp = ICONS[name as IconName] ?? Circle;
  return <Cmp size={size} color={color} strokeWidth={1.75} />;
}
