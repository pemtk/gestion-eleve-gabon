import { useState } from 'react';
import { Form, useNavigation } from 'react-router';
import { Icon } from '~/components/icon';
import { Button, Chips, Field, Textarea } from '~/components/ui';

interface Props {
  templates: Record<string, string>;
  className: string;
  students: number;
}

/** Message à une classe : des modèles prêts à l'emploi remplissent le texte, que l'enseignant peut modifier. */
export function AnnouncementForm({ templates, className, students }: Props) {
  const navigation = useNavigation();
  const [template, setTemplate] = useState('');
  const [message, setMessage] = useState('');
  const choose = (name: string) => {
    setTemplate(name);
    setMessage(templates[name] ?? '');
  };
  return (
    <Form method="post" className="flex max-w-2xl flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[12.5px] text-neutral-700">Modèle (facultatif)</legend>
        <Chips
          name="template"
          options={Object.keys(templates)}
          value={template}
          onChange={choose}
        />
      </fieldset>
      <Field label={`Message à la classe ${className}`}>
        <Textarea
          name="message"
          rows={5}
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Écrivez votre message aux élèves et aux parents…"
        />
      </Field>
      <p className="flex items-center gap-2 text-[13px] text-neutral-600">
        <Icon name="users" size={15} />
        <span>
          Reçu par les <span className="tnum">{students}</span> élèves de {className} et leurs
          parents.
        </span>
      </p>
      <div className="flex justify-end">
        <Button type="submit" icon="send" disabled={navigation.state !== 'idle' || !message.trim()}>
          Envoyer l’annonce
        </Button>
      </div>
    </Form>
  );
}
