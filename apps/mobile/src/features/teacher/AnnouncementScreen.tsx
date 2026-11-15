import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ANNOUNCE_TEMPLATES } from '@sge/shared';
import { Icon } from '@/components/icon';
import { Btn, Chips, Field, Header, Loading, Muted, Screen } from '@/components/ui';
import { useSession } from '@/lib/session';
import { C } from '@/theme';
import { ClassPicker } from './components/ClassPicker';
import { useClassPicker } from './use-class-picker';
import { NoClassNotice } from './components/NoClassNotice';
import { errorMessage } from './format';
import { ErrorNote, SuccessNote } from './components/Notices';

/** Annonce envoyée aux élèves et aux parents d'une classe (§6.6). */
export function AnnouncementScreen() {
  const router = useRouter();
  const { send } = useSession();
  const { classes, current, selected, select, error: classError } = useClassPicker();
  const [tpl, setTpl] = useState<string | null>('Évaluation');
  const [message, setMessage] = useState(ANNOUNCE_TEMPLATES['Évaluation'] ?? '');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (classes && !classes.length) return <NoClassNotice />;
  if (!current) return <Loading error={classError} />;
  const submit = async () => {
    setError(null);
    try {
      const r = await send<{ recipients: { students: number; parents: number } }>(
        'POST',
        '/me/teacher/announcements',
        { classId: current.id, message },
      );
      setSent(
        r.queued
          ? 'Annonce gardée, elle partira au retour du réseau.'
          : `Annonce envoyée à ${r.data?.recipients.students ?? current.students} élèves et ${r.data?.recipients.parents ?? 0} parents.`,
      );
    } catch (e) {
      setError(errorMessage(e, 'Envoi impossible.'));
    }
  };
  return (
    <Screen gap={16}>
      <Header
        title="Annonce à la classe"
        sub={`${current.name} · ${current.students} élèves`}
        close
      />
      <ClassPicker classes={classes} selected={selected} onSelect={select} />
      <View style={{ gap: 8 }}>
        <Muted size={13}>Partir d’un modèle</Muted>
        <Chips
          options={Object.keys(ANNOUNCE_TEMPLATES).map((k) => ({ key: k, label: k }))}
          value={tpl}
          onChange={(k) => {
            setTpl(k);
            setMessage(ANNOUNCE_TEMPLATES[k] ?? '');
          }}
        />
      </View>
      <Field
        label="Message"
        value={message}
        onChangeText={setMessage}
        multiline
        style={{ minHeight: 130 }}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Icon name="message-square" size={16} color={C.n[700]} />
        <Muted size={12.5}>Les parents sans smartphone la recevront par SMS.</Muted>
      </View>
      <ErrorNote text={error} />
      {sent ? (
        <>
          <SuccessNote text={sent} />
          <Btn label="Retour" onPress={() => router.back()} />
        </>
      ) : (
        <Btn icon="send" label="Envoyer à la classe" onPress={submit} disabled={!message.trim()} />
      )}
    </Screen>
  );
}
