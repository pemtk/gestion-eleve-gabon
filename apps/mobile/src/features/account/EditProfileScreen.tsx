import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { initials } from '@sge/shared';
import { Avatar, B, Btn, Field, Header, Muted, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { RemoteImage } from '@/components/remote-image';
import { pickPhoto, uploadPhoto, type Picked } from '@/lib/files';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { C, R } from '@/theme';

/** Nom, photo de profil et choix de qui peut voir la photo (§3.4). */
export function EditProfileScreen() {
  const router = useRouter();
  const { user } = useSession();
  const [first, setFirst] = useState(user?.name.split(' ')[0] ?? '');
  const [last, setLast] = useState(user?.name.split(' ').slice(1).join(' ') ?? '');
  const [vis, setVis] = useState<'school' | 'teachers' | 'private'>('school');
  const current = useApi<{
    photoVisibility: 'school' | 'teachers' | 'private';
    avatarFileId: string | null;
  }>('/me/profile');
  const [photo, setPhoto] = useState<Picked | null>(null);
  const [removed, setRemoved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (current.data && !loaded) {
      setVis(current.data.photoVisibility);
      setLoaded(true);
    }
  }, [current.data, loaded]);
  const avatarFileId = removed ? null : (current.data?.avatarFileId ?? null);
  const pick = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      const p = await pickPhoto(source, { square: true });
      if (p) {
        setPhoto(p);
        setRemoved(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo impossible.');
    }
  };
  const save = async () => {
    try {
      await api.put('/me/profile', { firstName: first, lastName: last, photoVisibility: vis });
      if (photo) await api.put('/me/avatar', { fileId: await uploadPhoto('avatar', photo) });
      else if (removed && current.data?.avatarFileId) await api.del('/me/avatar');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    }
  };
  return (
    <Screen gap={18}>
      <Header title="Nom et photo" />
      <View style={{ alignItems: 'center', gap: 8 }}>
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={{ width: 96, height: 96, borderRadius: 48 }}
            accessibilityLabel="Nouvelle photo de profil"
          />
        ) : avatarFileId ? (
          <RemoteImage fileId={avatarFileId} size={96} round />
        ) : (
          <Avatar initials={initials(`${first} ${last}`)} size={96} />
        )}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Btn
            variant="link"
            label="Prendre une photo"
            icon="camera"
            onPress={() => pick('camera')}
          />
          <Btn
            variant="link"
            label={photo || avatarFileId ? 'Changer (galerie)' : 'Galerie'}
            icon="image"
            onPress={() => pick('library')}
          />
          {(photo || avatarFileId) && (
            <Btn
              variant="link"
              label="Retirer"
              onPress={() => {
                setPhoto(null);
                setRemoved(true);
              }}
            />
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Prénom" value={first} onChangeText={setFirst} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Nom" value={last} onChangeText={setLast} />
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Muted size={13}>Qui peut voir ma photo ?</Muted>
        {VIS.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => setVis(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: vis === o.key }}
            style={{
              minHeight: 56,
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center',
              padding: 12,
              borderRadius: R.lg,
              borderWidth: vis === o.key ? 1.5 : 1,
              borderColor: vis === o.key ? C.accent : C.divider,
              backgroundColor: vis === o.key ? C.a[100] : 'transparent',
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 1.5,
                borderColor: C.accent,
                backgroundColor: vis === o.key ? C.accent : 'transparent',
              }}
            />
            <View>
              <B>{o.label}</B>
              <Muted size={12}>{o.sub}</Muted>
            </View>
          </Pressable>
        ))}
      </View>
      <Muted size={12.5}>Le numéro de téléphone ne peut être changé que par l’école.</Muted>
      {error && <B color={C.a[800]}>{error}</B>}
      <Btn label="Enregistrer" onPress={save} disabled={!first.trim() || !last.trim()} />
    </Screen>
  );
}

const VIS = [
  { key: 'school', label: 'L’école', sub: 'Enseignants et administration' },
  { key: 'teachers', label: 'Mes enseignants', sub: 'Seulement mes enseignants' },
  { key: 'private', label: 'Personne', sub: 'Mes initiales à la place' },
] as const;
