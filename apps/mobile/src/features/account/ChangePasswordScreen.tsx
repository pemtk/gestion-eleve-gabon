import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { isPasswordValid, passwordRules } from '@sge/shared';
import { Icon } from '@/components/icon';
import { B, Btn, Field, Header, Muted, Rules, Screen } from '@/components/ui';
import { api, ApiError, getRefreshToken } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { C } from '@/theme';

/** Changer le mot de passe, ou en choisir un premier quand le compte a été créé par l'école. */
export function ChangePasswordScreen() {
  const router = useRouter();
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [conf, setConf] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mismatch = conf.length > 0 && conf !== nw;
  // Compte créé par l'école ou activé par SMS : pas encore de mot de passe, on en choisit un sans saisir l'ancien.
  const me = useApi<{ hasPassword: boolean }>('/auth/me');
  const hasPassword = me.data?.hasPassword ?? true;
  const save = async () => {
    try {
      await api.post(
        hasPassword ? '/auth/password/change' : '/auth/password/set',
        hasPassword ? { current: cur, next: nw, confirm: conf } : { next: nw, confirm: conf },
        { 'X-Refresh-Token': getRefreshToken() ?? '' },
      );
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Changement impossible.');
    }
  };
  return (
    <Screen gap={16}>
      <Header title={hasPassword ? 'Changer le mot de passe' : 'Choisir un mot de passe'} />
      {hasPassword && (
        <Field label="Mot de passe actuel" value={cur} onChangeText={setCur} secureTextEntry />
      )}
      {hasPassword && (
        <Btn
          variant="link"
          label="Je ne m’en souviens plus"
          onPress={() => router.push('/forgot')}
        />
      )}
      <Field label="Nouveau mot de passe" value={nw} onChangeText={setNw} secureTextEntry />
      <Rules rules={passwordRules(nw)} />
      <Field
        label="Confirmer le nouveau mot de passe"
        value={conf}
        onChangeText={setConf}
        secureTextEntry
      />
      {mismatch && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Icon name="circle-alert" size={15} color={C.a[800]} />
          <B size={13} color={C.a[800]}>
            Les deux mots de passe ne sont pas identiques.
          </B>
        </View>
      )}
      {error && <B color={C.a[800]}>{error}</B>}
      <Btn
        label="Enregistrer"
        onPress={save}
        disabled={(hasPassword && !cur) || !isPasswordValid(nw) || nw !== conf}
      />
      <Muted size={12.5}>
        Vous restez connecté sur ce téléphone ; les autres appareils devront se reconnecter.
      </Muted>
    </Screen>
  );
}
