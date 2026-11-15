import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isPasswordValid, normalizePhone, passwordRules } from '@sge/shared';
import { Icon } from '@/components/icon';
import { B, Btn, Field, H, Rules, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { C } from '@/theme';
import { errorMessage } from './format';
import { PhoneField } from './components/PhoneField';
import { ErrorNote } from './components/ErrorNote';

/** Inscription d'un parent (les autres profils reçoivent leur compte de l'école). */
export function SignupScreen() {
  const router = useRouter();
  const [f, setF] = useState({ firstName: '', lastName: '', phone: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const ok =
    f.firstName.trim() &&
    f.lastName.trim() &&
    normalizePhone(f.phone).length >= 8 &&
    isPasswordValid(f.password);
  const submit = async () => {
    try {
      await api.post('/auth/signup', f);
      router.push({ pathname: '/otp', params: { phone: normalizePhone(f.phone) } });
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen gap={16}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={{
            width: 44,
            height: 44,
            marginLeft: -10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="chevron-left" size={24} />
        </Pressable>
        <View>
          <H size={34}>Créer un compte</H>
          <B color={C.n[700]} style={{ marginTop: 6 }}>
            Quelques informations, puis un code par SMS.
          </B>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Prénom"
              value={f.firstName}
              onChangeText={set('firstName')}
              autoComplete="given-name"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Nom"
              value={f.lastName}
              onChangeText={set('lastName')}
              autoComplete="family-name"
            />
          </View>
        </View>
        <PhoneField value={f.phone} onChange={set('phone')} />
        <Field
          label="Email · facultatif, recommandé"
          value={f.email}
          onChangeText={set('email')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Mot de passe"
          value={f.password}
          onChangeText={set('password')}
          secureTextEntry
        />
        <Rules rules={passwordRules(f.password)} />
        <ErrorNote text={error} />
        <Btn label="Recevoir le code par SMS" onPress={submit} disabled={!ok} />
        <B size={14} color={C.n[700]}>
          Votre école a déjà créé votre compte ?{' '}
          <B
            size={14}
            color={C.a[700]}
            style={{ textDecorationLine: 'underline' }}
            onPress={() =>
              router.push({ pathname: '/otp', params: { phone: normalizePhone(f.phone) } })
            }
          >
            Activez-le avec le code reçu
          </B>
          .
        </B>
      </Screen>
    </SafeAreaView>
  );
}
