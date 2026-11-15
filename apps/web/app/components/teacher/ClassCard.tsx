import { Link } from 'react-router';
import { Icon } from '~/components/icon';
import { ProgressBar, Tag } from '~/components/ui';
import { classKey } from './class-selection';
import type { TeacherClass } from './types';

/** Carte d'une classe : effectif et part des tâches terminées, avec un accès direct à l'appel. */
export function ClassCard({ item }: { item: TeacherClass }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-divider p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[22px] leading-tight">{item.name}</h3>
          <p className="text-[13px] text-neutral-600">{item.subject}</p>
        </div>
        {item.principal && <Tag tone="hi">Classe principale</Tag>}
      </header>
      <p className="flex items-center gap-2 text-[13.5px] text-neutral-700">
        <Icon name="users" size={15} className="text-accent-700" />
        <span className="tnum">{item.students}</span> élèves
      </p>
      <div>
        <div className="mb-1 flex justify-between text-[12px] text-neutral-600">
          <span>Tâches terminées</span>
          <span className="tnum">{item.pct === null ? '—' : `${item.pct} %`}</span>
        </div>
        <ProgressBar value={item.pct ?? 0} label={`Tâches terminées par ${item.name}`} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        <Link to={`/enseignant/appel?classe=${encodeURIComponent(classKey(item))}`}>
          Faire l’appel
        </Link>
        <Link to={`/enseignant/notes?classe=${encodeURIComponent(classKey(item))}`}>
          Saisir des notes
        </Link>
        <Link to={`/enseignant/classes?classe=${encodeURIComponent(classKey(item))}`}>
          Les élèves
        </Link>
      </div>
    </article>
  );
}
