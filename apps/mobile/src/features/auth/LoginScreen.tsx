import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { normalizePhone, ROLE_LABELS, MOBILE_ROLES, type Role } from '@sge/shared';
import { B, Btn, Field, H, Kicker, Screen, Seg } from '@/components/ui';
import { api } from '@/lib/api';
import { C, R } from '@/theme';
import { useFinish } from './use-finish';
import type { Session } from './types';
import { errorMessage } from './format';
import { Brand } from './components/Brand';
import { PhoneField } from './components/PhoneField';
import { ErrorNote } from './components/ErrorNote';

/** Connexion par numéro et mot de passe, ou par code SMS ; accès de démonstration si activé. */
export function LoginScreen() {
  const router = useRouter();
  const finish = useFinish();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<Session | { otpRequired: true }>('/auth/login', {
        mode,
        phone,
        password,
      });
      if ('otpRequired' in res)
        router.push({ pathname: '/otp', params: { phone: normalizePhone(phone) } });
      else setError(await finish(res));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const demo = async (role: Role) => {
    setBusy(true);
    setError(null);
    try {
      setError(await finish(await api.post<Session>(`/auth/demo/${role}`)));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen gap={22}>
        <Brand />
        <View>
          <H size={40}>Bonjour !</H>
          <B color={C.n[700]} style={{ marginTop: 8 }}>
            Connectez-vous avec votre numéro de téléphone.
          </B>
        </View>
        <PhoneField value={phone} onChange={setPhone} />
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            { key: 'password', label: 'Mot de passe', icon: 'key-round' },
            { key: 'otp', label: 'Code SMS', icon: 'message-square' },
          ]}
        />
        {mode === 'password' ? (
          <View style={{ gap: 4 }}>
            <Field
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
            />
            <Btn
              variant="link"
              label="Mot de passe oublié ?"
              onPress={() => router.push('/forgot')}
              style={{ alignSelf: 'flex-end' }}
            />
          </View>
        ) : (
          <B size={14} color={C.n[700]}>
            Nous allons vous envoyer un code à 6 chiffres par SMS. Pas besoin de mot de passe.
          </B>
        )}
        <ErrorNote text={error} />
        <Btn
          label={mode === 'password' ? 'Connexion' : 'Recevoir le code'}
          icon="arrow-right"
          onPress={submit}
          disabled={busy || !phone}
        />
        {DEMO && (
          <View style={{ borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 16, gap: 10 }}>
            <Kicker>Démo — choisir un profil</Kicker>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {MOBILE_ROLES.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => demo(r)}
                  disabled={busy}
                  accessibilityRole="button"
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderWidth: 1,
                    borderColor: C.divider,
                    borderRadius: R.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <B size={13.5}>{ROLE_LABELS[r]}</B>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        <B size={14} color={C.n[700]} style={{ textAlign: 'center' }}>
          Pas encore de compte ?{' '}
          <B
            size={14}
            color={C.a[700]}
            style={{ textDecorationLine: 'underline' }}
            onPress={() => router.push('/signup')}
          >
            Créer un compte
          </B>
        </B>
      </Screen>
    </SafeAreaView>
  );
}

const DEMO = __DEV__ || process.env.EXPO_PUBLIC_DEMO === 'true';
