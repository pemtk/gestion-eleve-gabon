import { useState } from 'react';
import { FILE_POLICIES, acceptedTypes, formatBytes, type FileKind } from '@sge/shared';
import { Icon } from '../icon';

/**
 * Sélecteur de fichier avec les limites de l'usage (types et taille) : un fichier trop gros ou d'un autre type est refusé tout de suite,
 * avant l'envoi ; le serveur revérifie de toute façon d'après le contenu réel.
 */
export function FilePicker({
  name,
  kind,
  label,
  onPick,
}: {
  name: string;
  kind: FileKind;
  label: string;
  onPick?: (file: File | null) => void;
}) {
  const policy = FILE_POLICIES[kind];
  const [picked, setPicked] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accept = policy.types.join(',');
  const change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    const problem =
      file && file.size > policy.maxBytes
        ? `Fichier trop volumineux : ${formatBytes(policy.maxBytes)} au maximum.`
        : file && !policy.types.includes(file.type)
          ? `Format non accepté : ${acceptedTypes(kind)}.`
          : null;
    if (problem) e.target.value = '';
    setError(problem);
    setPicked(problem ? null : file);
    onPick?.(problem ? null : file);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-dashed border-neutral-500 px-3.5 py-2.5 hover:bg-neutral-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
        <span className="text-[14px]">
          {label}
          <span className="block text-[12px] text-neutral-600">
            {picked
              ? `${picked.name} · ${formatBytes(picked.size)}`
              : `${acceptedTypes(kind)}, ${formatBytes(policy.maxBytes)} maximum`}
          </span>
        </span>
        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-md border-[1.5px] border-accent px-3 text-[13px] font-semibold text-accent-800">
          <Icon name="paperclip" size={14} />
          {picked ? 'Changer' : 'Choisir'}
        </span>
        <input type="file" name={name} accept={accept} onChange={change} className="sr-only" />
      </label>
      {error && (
        <span role="alert" className="flex items-center gap-1.5 text-[12px] text-accent-800">
          <Icon name="circle-alert" size={13} />
          {error}
        </span>
      )}
    </div>
  );
}
