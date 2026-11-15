import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { TASK_TYPES, type TaskType } from '@sge/shared';
import { Icon } from '@/components/icon';
import {
  B,
  Btn,
  Card,
  Chips,
  Field,
  Header,
  Loading,
  Muted,
  Screen,
  Seg,
  Toggle,
} from '@/components/ui';
import { useSession } from '@/lib/session';
import { C } from '@/theme';
import { ClassPicker } from './components/ClassPicker';
import { useClassPicker } from './use-class-picker';
import { NoClassNotice } from './components/NoClassNotice';
import { errorMessage } from './format';
import { ErrorNote } from './components/Notices';

/** Publier une tâche (exercice, cours ou devoir) pour une classe. */
export function NewTaskScreen() {
  const router = useRouter();
  const { send } = useSession();
  const { classes, current, selected, select, error: classError } = useClassPicker();
  const [type, setType] = useState<TaskType>('Exercice');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('Demain');
  const [est, setEst] = useState<string | null>('30');
  const [photo, setPhoto] = useState(false);
  const [graded, setGraded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  if (classes && !classes.length) return <NoClassNotice />;
  if (!current) return <Loading error={classError} />;
  const h = TYPE_HELP[type];
  const publish = async () => {
    if (!title.trim()) return setError('Le titre est obligatoire.');
    try {
      await send('POST', '/me/teacher/tasks', {
        classId: current.id,
        subject: current.subject,
        type,
        title,
        description: desc,
        due,
        estimateMinutes: est ? Number(est) : undefined,
        requirePhoto: photo,
        graded: type === 'Devoir' && graded,
      });
      router.replace('/prof');
    } catch (e) {
      setError(errorMessage(e, 'Publication impossible.'));
    }
  };
  return (
    <Screen gap={16}>
      <Header title="Nouvelle tâche" sub={`${current.name} · ${current.subject}`} close />
      <ClassPicker classes={classes} selected={selected} onSelect={select} />
      <Seg
        value={type}
        onChange={setType}
        options={TASK_TYPES.map((t) => ({ key: t, label: t, icon: TYPE_HELP[t].icon }))}
      />
      <Card tint style={{ flexDirection: 'row', gap: 10 }}>
        <Icon name={h.icon} size={18} color={C.a[800]} />
        <B size={13.5} color={C.a[800]} style={{ flex: 1 }}>
          {h.hint}
        </B>
      </Card>
      <Field
        label="Titre"
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          setError(null);
        }}
        placeholder="Ex. Fractions : exercices 4 à 9"
      />
      <Field label={h.desc} value={desc} onChangeText={setDesc} multiline />
      <View style={{ gap: 8 }}>
        <Muted size={13}>{h.due}</Muted>
        <Chips
          options={['Aujourd’hui', 'Demain', 'Vendredi', 'Lundi'].map((d) => ({
            key: d,
            label: d,
          }))}
          value={due}
          onChange={setDue}
        />
      </View>
      <View style={{ gap: 8 }}>
        <Muted size={13}>{h.est} · facultatif</Muted>
        <Chips
          options={['15', '30', '45', '60'].map((m) => ({ key: m, label: `${m} min` }))}
          value={est}
          onChange={setEst}
        />
      </View>
      {type === 'Exercice' && (
        <Toggle
          label="Demander une photo du cahier"
          sub="Facultatif pour l’élève"
          value={photo}
          onChange={setPhoto}
        />
      )}
      {type === 'Devoir' && (
        <>
          <Toggle
            label="Photo du devoir obligatoire"
            sub="L’élève ne peut pas valider sans photo"
            value={photo}
            onChange={setPhoto}
          />
          <Toggle
            label="Devoir noté"
            sub="Ajoute une note sur 20 au bulletin"
            value={graded}
            onChange={setGraded}
          />
        </>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Icon name="users" size={16} color={C.n[700]} />
        <Muted size={12.5}>
          {current.students} élèves de {current.name} et leurs parents seront prévenus.
        </Muted>
      </View>
      <ErrorNote text={error} />
      <Btn icon="send" label="Publier la tâche" onPress={publish} />
    </Screen>
  );
}

const TYPE_HELP: Record<
  TaskType,
  { hint: string; icon: string; desc: string; due: string; est: string }
> = {
  Cours: {
    hint: 'Support à lire ou à regarder. L’élève le marque comme lu ; ni note ni preuve demandée.',
    icon: 'book-open',
    desc: 'Résumé du cours',
    due: 'À lire avant',
    est: 'Durée de lecture',
  },
  Exercice: {
    hint: 'Entraînement : l’élève lance le minuteur, puis s’auto-évalue (« J’ai compris » / « J’ai des doutes »).',
    icon: 'pencil',
    desc: 'Consigne',
    due: 'À faire pour',
    est: 'Temps estimé',
  },
  Devoir: {
    hint: 'Travail à rendre : photo du devoir et, si vous le souhaitez, une note sur 20.',
    icon: 'file-check',
    desc: 'Sujet du devoir',
    due: 'À rendre le',
    est: 'Temps estimé',
  },
};
