import { useState } from 'react';
import { Form, useNavigation } from 'react-router';
import { TASK_TYPES, type TaskType } from '@sge/shared';
import { Icon } from '~/components/icon';
import { Button, Chips, Field, Input, Select, Textarea, Toggle } from '~/components/ui';
import { classKey } from './class-selection';
import { DUE_CHOICES, ESTIMATE_CHOICES, TASK_HELP } from './task-help';
import type { TeacherClass } from './types';

/** Formulaire de publication d'une tâche : le type change les consignes affichées et les options proposées. */
export function TaskForm({
  classes,
  initialClass,
}: {
  classes: TeacherClass[];
  initialClass: string;
}) {
  const navigation = useNavigation();
  const [type, setType] = useState<TaskType>('Exercice');
  const [due, setDue] = useState(DUE_CHOICES[1]!);
  const [estimate, setEstimate] = useState(ESTIMATE_CHOICES[1]!);
  const [photo, setPhoto] = useState(false);
  const [graded, setGraded] = useState(true);
  const [classValue, setClassValue] = useState(initialClass);
  const help = TASK_HELP[type];
  const target = classes.find((c) => classKey(c) === classValue);

  return (
    <Form method="post" className="flex max-w-2xl flex-col gap-5">
      <input type="hidden" name="graded" value={String(type === 'Devoir' && graded)} />
      <Field label="Classe">
        <Select name="classe" value={classValue} onChange={(e) => setClassValue(e.target.value)}>
          {classes.map((c) => (
            <option key={classKey(c)} value={classKey(c)}>
              {c.name} · {c.subject}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[12.5px] text-neutral-700">Type de tâche</legend>
        <Chips
          name="type"
          options={[...TASK_TYPES]}
          value={type}
          onChange={(v) => setType(v as TaskType)}
        />
        <p className="flex items-start gap-2 rounded-md bg-accent-100 px-3 py-2 text-[13px] text-accent-800">
          <Icon name={help.icon} size={16} className="mt-0.5 flex-none" />
          {help.hint}
        </p>
      </fieldset>
      <Field label="Titre">
        <Input name="title" required placeholder="Ex. Fractions : exercices 4 à 9" />
      </Field>
      <Field label={help.description}>
        <Textarea name="description" rows={3} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[12.5px] text-neutral-700">{help.due}</legend>
        <Chips name="due" options={DUE_CHOICES} value={due} onChange={setDue} />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[12.5px] text-neutral-700">{help.estimate}</legend>
        <Chips name="estimate" options={ESTIMATE_CHOICES} value={estimate} onChange={setEstimate} />
      </fieldset>
      {type !== 'Cours' && (
        <Toggle
          name="requirePhoto"
          checked={photo}
          onChange={setPhoto}
          label={type === 'Devoir' ? 'Photo du devoir obligatoire' : 'Demander une photo du cahier'}
          sub={
            type === 'Devoir' ? 'L’élève ne peut pas valider sans photo' : 'Facultatif pour l’élève'
          }
        />
      )}
      {type === 'Devoir' && (
        <Toggle
          label="Devoir noté"
          sub="Ajoute une note sur 20 au bulletin"
          checked={graded}
          onChange={setGraded}
        />
      )}
      {target && (
        <p className="flex items-center gap-2 text-[13px] text-neutral-600">
          <Icon name="users" size={15} />
          <span>
            Les <span className="tnum">{target.students}</span> élèves de {target.name} et leurs
            parents seront prévenus.
          </span>
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" icon="send" disabled={navigation.state !== 'idle'}>
          Publier la tâche
        </Button>
      </div>
    </Form>
  );
}
