import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Avatar, B, Btn, H, Header, Muted, Screen, Seg, Chips } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { C, F, R } from '@/theme';

/** Rattacher un enfant avec le code d'invitation fourni par l'école. */
export function AddChildScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'code' | 'qr'>('code');
  const [code, setCode] = useState('');
  const [rel, setRel] = useState<(typeof RELATIONS)[number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    status: 'active' | 'pending';
    child: { name: string; className: string };
    note: string;
  } | null>(null);
  const ready = rel && (mode === 'qr' || code.length === 6);
  const submit = async () => {
    try {
      setError(null);
      setDone(
        await api.post('/me/parent/children/link', {
          mode,
          code: mode === 'code' ? code : undefined,
          relation: rel,
        }),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Rattachement impossible.');
    }
  };
  return (
    <Screen gap={18}>
      <Header title="Ajouter un enfant" />
      {done ? (
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 20 }}>
          <Avatar
            initials={done.child.name
              .split(' ')
              .map((p) => p[0])
              .join('')}
            size={80}
          />
          <H size={26} semi>
            {done.child.name}
          </H>
          <Muted>{done.child.className}</Muted>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon
              name={done.status === 'active' ? 'circle-check' : 'hourglass'}
              size={18}
              color={C.a[800]}
            />
            <B color={C.a[800]} semi>
              {done.status === 'active' ? 'Rattachement actif' : 'En attente de validation'}
            </B>
          </View>
          <Muted style={{ textAlign: 'center' }}>{done.note}</Muted>
          <Btn
            label="Retour à l’accueil"
            onPress={() => router.replace('/parent')}
            style={{ marginTop: 10 }}
          />
        </View>
      ) : (
        <>
          <B color={C.n[700]}>L’école vous a remis un code à 6 chiffres ou un QR code.</B>
          <Seg
            value={mode}
            onChange={setMode}
            options={[
              { key: 'code', label: 'Code à 6 chiffres', icon: 'hash' },
              { key: 'qr', label: 'QR code', icon: 'qr-code' },
            ]}
          />
          {mode === 'code' ? (
            <View style={{ gap: 7 }}>
              <TextInput
                accessibilityLabel="Code à 6 chiffres"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="······"
                placeholderTextColor={C.n[500]}
                style={{
                  minHeight: 64,
                  textAlign: 'center',
                  borderWidth: 1,
                  borderColor: C.divider,
                  borderRadius: R.lg,
                  fontFamily: F.heading,
                  fontSize: 36,
                  letterSpacing: 10,
                  color: C.text,
                }}
              />
              <Muted size={12.5}>Le code figure sur la fiche remise par l’école.</Muted>
            </View>
          ) : (
            <View
              style={{
                height: 200,
                borderRadius: R.lg,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: C.a[400],
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Icon name="scan-line" size={44} color={C.a[700]} />
              <Muted>caméra · visez le QR code</Muted>
            </View>
          )}
          <View style={{ gap: 8 }}>
            <Muted size={13}>Vous êtes</Muted>
            <Chips
              options={RELATIONS.map((r) => ({ key: r, label: r }))}
              value={rel}
              onChange={setRel}
            />
          </View>
          {error && <B color={C.a[800]}>{error}</B>}
          <Btn label="Rattacher mon enfant" onPress={submit} disabled={!ready} />
        </>
      )}
    </Screen>
  );
}

const RELATIONS = ['père', 'mère', 'tuteur', 'tutrice'] as const;
