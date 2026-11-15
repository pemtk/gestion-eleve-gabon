import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { formatTimer } from '@/lib/format';
import { Icon } from '@/components/icon';
import { B, Btn, H, Header, Kicker, Muted, Screen } from '@/components/ui';
import { pickPhoto, uploadPhoto, type Picked } from '@/lib/files';
import { useSession } from '@/lib/session';
import { C, R } from '@/theme';

/** Auto-évaluation et photo de preuve facultative avant de valider une tâche (§4.3). */
export function SelfEvaluationScreen() {
  const { id, sec, title } = useLocalSearchParams<{ id: string; sec: string; title?: string }>();
  const router = useRouter();
  const { send, offline } = useSession();
  const [choice, setChoice] = useState<'ok' | 'doubt' | null>(null);
  const [photo, setPhoto] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validate = async () => {
    if (!choice) return;
    setBusy(true);
    setError(null);
    try {
      // La photo est envoyée d'abord (elle n'est pas gardée hors ligne) ; la validation, elle, peut attendre le retour du réseau.
      if (photo && offline)
        throw new Error(
          'Pas de réseau : la photo ne peut pas être envoyée maintenant. Retire-la pour valider, ou réessaie avec du réseau.',
        );
      const proofFileId = photo ? await uploadPhoto('proof', photo) : undefined;
      const res = await send<{
        gained: number;
        points: number;
        streak: number;
        message: string;
        newBadges: { id: string; label: string }[];
      }>('POST', `/me/student/tasks/${id}/complete`, {
        evaluation: choice,
        proofFileId,
        seconds: Number(sec),
      });
      router.replace({
        pathname: '/eleve/bravo',
        params: {
          gained: String(res.data?.gained ?? 20),
          points: String(res.data?.points ?? ''),
          streak: String(res.data?.streak ?? ''),
          badges: (res.data?.newBadges ?? []).map((b) => b.label).join('|'),
          queued: res.queued ? '1' : '',
          note: res.data?.message ?? '',
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setBusy(false);
    }
  };
  const take = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      const p = await pickPhoto(source);
      if (p) setPhoto(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo impossible.');
    }
  };
  return (
    <Screen gap={18}>
      <Header title="" close />
      <Kicker>
        {title ?? 'Tâche'} · {formatTimer(Number(sec) || 0)} de travail
      </Kicker>
      <H size={34}>Comment ça s’est passé ?</H>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(
          [
            ['ok', 'smile', 'J’ai compris'],
            ['doubt', 'circle-help', 'J’ai des doutes'],
          ] as const
        ).map(([k, icon, label]) => (
          <Pressable
            key={k}
            onPress={() => setChoice(k)}
            accessibilityRole="radio"
            accessibilityState={{ selected: choice === k }}
            style={{
              flex: 1,
              minHeight: 132,
              padding: 16,
              borderRadius: R.lg,
              borderWidth: choice === k ? 1.5 : 1,
              borderColor: choice === k ? C.accent : C.divider,
              backgroundColor: choice === k ? C.a[100] : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <Icon name={icon} size={34} color={C.a[700]} />
            <H size={19} semi style={{ textAlign: 'center' }}>
              {label}
            </H>
          </Pressable>
        ))}
      </View>
      <View
        style={{
          padding: 14,
          borderRadius: R.lg,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: photo ? C.accent : C.a[400],
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {photo ? (
            <Image
              source={{ uri: photo.uri }}
              style={{ width: 64, height: 64, borderRadius: 8 }}
              accessibilityLabel="Photo ajoutée"
            />
          ) : (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: C.a[100],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="camera" size={20} color={C.a[800]} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <B>{photo ? 'Photo ajoutée' : 'Ajouter une preuve'}</B>
            <Muted size={12}>Facultatif · photo de ton cahier. Seul ton enseignant la voit.</Muted>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn
            variant="link"
            label="Prendre une photo"
            icon="camera"
            onPress={() => take('camera')}
          />
          <Btn variant="link" label="Galerie" icon="image" onPress={() => take('library')} />
          {photo && <Btn variant="link" label="Retirer" onPress={() => setPhoto(null)} />}
        </View>
      </View>
      {error && <B color={C.a[800]}>{error}</B>}
      <Btn label="Valider" onPress={validate} disabled={!choice || busy} />
    </Screen>
  );
}
