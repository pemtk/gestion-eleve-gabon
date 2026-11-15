import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isPasswordValid, normalizePhone, passwordRules } from '@sge/shared';
import { Icon } from '@/components/icon';
import { B, Btn, Field, H, Rules, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { C } from '@/theme';
import { errorMessage } from './format';
import { PhoneField } from './components/PhoneField';
import { ErrorNote } from './components/ErrorNote';
import { CodeBoxes } from './components/CodeBoxes';

/** Mot de passe oublié : numéro, code reçu par SMS, nouveau mot de passe. */
export function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const next = async () => {
    try {
      setError(null);
      await api.post('/auth/password/forgot', { phone });
      setStep(2);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const done = async () => {
    try {
      setError(null);
      await api.post('/auth/password/reset', { phone, code, password });
      router.replace('/login');
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen gap={20}>
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
        <H size={34}>Mot de passe oublié</H>
        {step === 1 ? (
          <>
            <B color={C.n[700]}>
              Saisissez votre numéro : nous vous envoyons un code pour choisir un nouveau mot de
              passe.
            </B>
            <PhoneField value={phone} onChange={setPhone} />
            <ErrorNote text={error} />
            <Btn
              label="Recevoir un code"
              onPress={next}
              disabled={normalizePhone(phone).length < 8}
            />
          </>
        ) : (
          <>
            <B color={C.n[700]}>
              Code envoyé au <B>+241 {normalizePhone(phone)}</B>.
            </B>
            <CodeBoxes value={code} onChange={setCode} />
            <Field
              label="Nouveau mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Rules rules={passwordRules(password)} />
            <ErrorNote text={error} />
            <Btn
              label="Enregistrer"
              onPress={done}
              disabled={code.length < 6 || !isPasswordValid(password)}
            />
          </>
        )}
      </Screen>
    </SafeAreaView>
  );
}
