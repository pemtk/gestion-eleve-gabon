import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/icon';
import { B, Btn, H, Muted, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { C, R } from '@/theme';
import { useFinish } from './use-finish';
import type { Session } from './types';
import { errorMessage } from './format';
import { CodeBoxes } from './components/CodeBoxes';
import { ErrorNote } from './components/ErrorNote';

/** Saisie du code à 6 chiffres reçu par SMS (activation d'un compte ou connexion). */
export function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const finish = useFinish();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const verify = async () => {
    try {
      setError(await finish(await api.post<Session>('/auth/otp/verify', { phone, code })));
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen gap={22}>
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
          <H size={34}>Code de vérification</H>
          <B color={C.n[700]} style={{ marginTop: 10 }}>
            Saisissez le code reçu par SMS au <B>+241 {phone}</B>.
          </B>
        </View>
        <CodeBoxes value={code} onChange={setCode} />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="clock" size={16} color={C.n[700]} />
          <B size={14} color={C.n[700]}>
            Pas reçu ?{' '}
          </B>
          <Btn
            variant="link"
            label="Renvoyer un code"
            onPress={() => void api.post('/auth/otp/request', { phone })}
          />
        </View>
        <ErrorNote text={error} />
        <Btn label="Valider" onPress={verify} disabled={code.length < 6} />
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            padding: 14,
            borderWidth: 1,
            borderColor: C.divider,
            borderRadius: R.lg,
          }}
        >
          <Icon name="info" size={17} color={C.a[700]} />
          <Muted size={13.5} style={{ flex: 1 }}>
            Pas de code ? Vérifiez que vous avez du réseau, puis attendez une minute avant d’en
            redemander un.
          </Muted>
        </View>
      </Screen>
    </SafeAreaView>
  );
}
