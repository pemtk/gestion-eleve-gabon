import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Avatar, B, Btn, Card, Field, H, Header, Muted, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { C, R } from '@/theme';
import { errorMessage } from './format';
import { ErrorNote, SuccessNote } from './components/Notices';

/** Signaler une difficulté ou un fait de vie scolaire concernant un élève (§6.7). */
export function ReportScreen() {
  const router = useRouter();
  const { student, studentId } = useLocalSearchParams<{ student?: string; studentId?: string }>();
  const [kind, setKind] = useState<'conduite' | 'confidentiel' | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const name = student ?? 'Élève';
  const submit = async () => {
    try {
      await api.post('/me/teacher/reports', { studentId, kind, description: text });
      setSent(
        kind === 'confidentiel'
          ? 'Signalement envoyé. Le référent est prévenu, sans le détail.'
          : 'Signalement envoyé à l’école.',
      );
    } catch (e) {
      setError(errorMessage(e, 'Envoi impossible.'));
    }
  };
  return (
    <Screen gap={16}>
      <Header title="Signaler une situation" close />
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Avatar
          initials={name
            .split(' ')
            .map((p) => p[0])
            .join('')}
          size={42}
        />
        <View>
          <B semi>{name}</B>
          <Muted size={12.5}>Élève de vos classes</Muted>
        </View>
      </Card>
      {sent ? (
        <>
          <SuccessNote text={sent} />
          <Btn label="Retour au suivi" onPress={() => router.back()} />
        </>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <Muted size={13}>De quoi s’agit-il ?</Muted>
            {(
              [
                [
                  'conduite',
                  'flag',
                  'Conduite / engagement',
                  'Visible par l’école et éventuellement le parent',
                ],
                [
                  'confidentiel',
                  'shield',
                  'Confidentiel',
                  'Harcèlement, mal-être, difficulté personnelle',
                ],
              ] as const
            ).map(([k, i, l, d]) => (
              <Pressable
                key={k}
                onPress={() => {
                  setKind(k);
                  setError(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: kind === k }}
                style={{
                  minHeight: 64,
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: R.lg,
                  borderWidth: kind === k ? 1.5 : 1,
                  borderColor: kind === k ? C.accent : C.divider,
                  backgroundColor: kind === k ? C.a[100] : 'transparent',
                }}
              >
                <Icon name={i} size={22} color={C.a[700]} />
                <View style={{ flex: 1 }}>
                  <H size={19} semi>
                    {l}
                  </H>
                  <Muted size={12}>{d}</Muted>
                </View>
              </Pressable>
            ))}
          </View>
          {kind && (
            <>
              <Field
                label="Décrivez la situation"
                value={text}
                onChangeText={setText}
                multiline
                placeholder="Les faits observés, quand et où."
              />
              <Card tint style={{ flexDirection: 'row', gap: 10 }}>
                <Icon name={kind === 'confidentiel' ? 'lock' : 'eye'} size={17} color={C.a[800]} />
                <B size={13} color={C.a[800]} style={{ flex: 1 }}>
                  {kind === 'confidentiel'
                    ? 'Seuls le référent vie scolaire et le directeur verront le détail.'
                    : 'L’école verra ce signalement ; le parent selon les réglages de l’école.'}
                </B>
              </Card>
            </>
          )}
          <ErrorNote text={error} />
          <Btn
            label="Envoyer le signalement"
            onPress={submit}
            disabled={!kind || !text.trim() || !studentId}
          />
        </>
      )}
    </Screen>
  );
}
