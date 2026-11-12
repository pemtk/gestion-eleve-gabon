import { Circle } from 'lucide-react';
import { ICONS, type IconName } from './icons.generated';

/** Icône Lucide désignée par son nom (celui du design : « school », « chevron-down »…). */
export function Icon({ name, size = 16, className, ...rest }: { name: string; size?: number; className?: string; 'aria-label'?: string }) {
  const Cmp = ICONS[name as IconName] ?? Circle;
  const decorative = !rest['aria-label'];
  return <Cmp size={size} strokeWidth={1.75} className={className} aria-hidden={decorative} {...(decorative ? {} : { role: 'img', ...rest })} />;
}
