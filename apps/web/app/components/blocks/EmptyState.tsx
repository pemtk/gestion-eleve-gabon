import { Icon } from '../icon';

export function EmptyState({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-accent-400 text-accent-700">
        <Icon name={icon} size={22} />
      </div>
      <div className="font-heading text-[22px]">{title}</div>
      {text && <p className="max-w-sm text-[14px] text-neutral-700">{text}</p>}
    </div>
  );
}
