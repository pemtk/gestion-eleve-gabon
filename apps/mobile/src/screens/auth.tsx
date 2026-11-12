import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isPasswordValid, normalizePhone, passwordRules, ROLE_LABELS, MOBILE_ROLES, type Role, type SessionUser } from '@sge/shared';
import { Icon } from '@/components/icon';
import { B, Btn, Field, H, Kicker, Muted, Rules, Screen, Seg } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { HOME, useSession } from '@/lib/session';
import { C, F, R } from '@/theme';

type Session = { accessToken: string; user: SessionUser };
const DEMO = __DEV__ || process.env.EXPO_PUBLIC_DEMO === 'true';
const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Connexion impossible. Vérifiez le réseau.');

/** Ouvre la session ; les profils web (établissement, agent…) sont invités à utiliser le site. */
function useFinish() {
  const { signIn } = useSession();
  const router = useRouter();
  return async (s: Session): Promise<string | null> => {
    if (!HOME[s.user.role]) return `Le profil ${ROLE_LABELS[s.user.role].toLowerCase()} utilise l’application web.`;
    await signIn(s.accessToken, s.user);
    router.replace(HOME[s.user.role] as '/');
    return null;
  };
}

const Brand = () => (
  <Image source={require('../../assets/images/logo.png')} accessibilityLabel="Gestion Élève Gabon" style={{ width: 150, height: 150, alignSelf: 'center' }} resizeMode="contain" />
);
const Phone = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <View style={{ gap: 7 }}>
    <Muted size={13}>Numéro de téléphone</Muted>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ minHeight: 52, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderColor: C.divider, borderRadius: R.lg }}><B size={16}>+241</B></View>
      <TextInput accessibilityLabel="Numéro de téléphone" value={value} onChangeText={onChange} keyboardType="phone-pad" placeholder="07 00 00 00" placeholderTextColor={C.n[500]} autoComplete="tel"
        style={{ flex: 1, minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, fontFamily: F.body, fontSize: 17, letterSpacing: 0.7, color: C.text }} />
    </View>
  </View>
);
const Err = ({ text }: { text: string | null }) => (text ? <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: R.lg, backgroundColor: C.a[100], borderWidth: 1, borderColor: C.a[300] }}><Icon name="circle-alert" size={17} color={C.a[800]} /><B size={13.5} color={C.a[800]} style={{ flex: 1 }}>{text}</B></View> : null);

export function Login() {
  const router = useRouter();
  const finish = useFinish();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await api.post<Session | { otpRequired: true }>('/auth/login', { mode, phone, password });
      if ('otpRequired' in res) router.push({ pathname: '/otp', params: { phone: normalizePhone(phone) } });
      else setError(await finish(res));
    } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };
  const demo = async (role: Role) => {
    setBusy(true); setError(null);
    try { setError(await finish(await api.post<Session>(`/auth/demo/${role}`))); } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen gap={22}>
        <Brand />
        <View><H size={40}>Bonjour !</H><B color={C.n[700]} style={{ marginTop: 8 }}>Connectez-vous avec votre numéro de téléphone.</B></View>
        <Phone value={phone} onChange={setPhone} />
        <Seg value={mode} onChange={setMode} options={[{ key: 'password', label: 'Mot de passe', icon: 'key-round' }, { key: 'otp', label: 'Code SMS', icon: 'message-square' }]} />
        {mode === 'password' ? (
          <View style={{ gap: 4 }}>
            <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
            <Btn variant="link" label="Mot de passe oublié ?" onPress={() => router.push('/forgot')} style={{ alignSelf: 'flex-end' }} />
          </View>
        ) : <B size={14} color={C.n[700]}>Nous allons vous envoyer un code à 6 chiffres par SMS. Pas besoin de mot de passe.</B>}
        <Err text={error} />
        <Btn label={mode === 'password' ? 'Connexion' : 'Recevoir le code'} icon="arrow-right" onPress={submit} disabled={busy || !phone} />
        {DEMO && (
          <View style={{ borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 16, gap: 10 }}>
            <Kicker>Démo — choisir un profil</Kicker>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {MOBILE_ROLES.map((r) => (
                <Pressable key={r} onPress={() => demo(r)} disabled={busy} accessibilityRole="button" style={{ flex: 1, minHeight: 44, borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center' }}>
                  <B size={13.5}>{ROLE_LABELS[r]}</B>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        <B size={14} color={C.n[700]} style={{ textAlign: 'center' }}>Pas encore de compte ? <B size={14} color={C.a[700]} style={{ textDecorationLine: 'underline' }} onPress={() => router.push('/signup')}>Créer un compte</B></B>
      </Screen>
    </SafeAreaView>
  );
}

/** Saisie du code à 6 chiffres : un champ réel (clavier numérique, remplissage SMS) affiché en 6 cases. */
function CodeBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="Code à 6 chiffres" style={{ flexDirection: 'row', gap: 8 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 58, borderRadius: R.lg, borderWidth: 1, borderColor: value.length === i ? C.accent : C.divider, backgroundColor: value[i] ? C.a[100] : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          <H size={30} style={{ fontVariant: ['tabular-nums'] }}>{value[i] ?? ''}</H>
        </View>
      ))}
      <TextInput ref={ref} value={value} onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} autoFocus />
    </Pressable>
  );
}

export function Otp() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const finish = useFinish();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const verify = async () => {
    try { setError(await finish(await api.post<Session>('/auth/otp/verify', { phone, code }))); } catch (e) { setError(msg(e)); }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen gap={22}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={{ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron-left" size={24} /></Pressable>
        <View><H size={34}>Code de vérification</H><B color={C.n[700]} style={{ marginTop: 10 }}>Saisissez le code reçu par SMS au <B>+241 {phone}</B>.</B></View>
        <CodeBoxes value={code} onChange={setCode} />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Icon name="clock" size={16} color={C.n[700]} /><B size={14} color={C.n[700]}>Pas reçu ? </B><Btn variant="link" label="Renvoyer un code" onPress={() => void api.post('/auth/otp/request', { phone })} /></View>
        <Err text={error} />
        <Btn label="Valider" onPress={verify} disabled={code.length < 6} />
        <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderWidth: 1, borderColor: C.divider, borderRadius: R.lg }}>
          <Icon name="info" size={17} color={C.a[700]} /><Muted size={13.5} style={{ flex: 1 }}>Pas de code ? Vérifiez que vous avez du réseau, puis attendez une minute avant d’en redemander un.</Muted>
        </View>
      </Screen>
    </SafeAreaView>
  );
}

export function Signup() {
  const router = useRouter();
  const [f, setF] = useState({ firstName: '', lastName: '', phone: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const ok = f.firstName.trim() && f.lastName.trim() && normalizePhone(f.phone).length >= 8 && isPasswordValid(f.password);
  const submit = async () => {
    try { await api.post('/auth/signup', f); router.push({ pathname: '/otp', params: { phone: normalizePhone(f.phone) } }); } catch (e) { setError(msg(e)); }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen gap={16}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={{ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron-left" size={24} /></Pressable>
        <View><H size={34}>Créer un compte</H><B color={C.n[700]} style={{ marginTop: 6 }}>Quelques informations, puis un code par SMS.</B></View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Prénom" value={f.firstName} onChangeText={set('firstName')} autoComplete="given-name" /></View>
          <View style={{ flex: 1 }}><Field label="Nom" value={f.lastName} onChangeText={set('lastName')} autoComplete="family-name" /></View>
        </View>
        <Phone value={f.phone} onChange={set('phone')} />
        <Field label="Email · facultatif, recommandé" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Mot de passe" value={f.password} onChangeText={set('password')} secureTextEntry />
        <Rules rules={passwordRules(f.password)} />
        <Err text={error} />
        <Btn label="Recevoir le code par SMS" onPress={submit} disabled={!ok} />
        <B size={14} color={C.n[700]}>Votre école a déjà créé votre compte ? <B size={14} color={C.a[700]} style={{ textDecorationLine: 'underline' }} onPress={() => router.push({ pathname: '/otp', params: { phone: normalizePhone(f.phone) } })}>Activez-le avec le code reçu</B>.</B>
      </Screen>
    </SafeAreaView>
  );
}

export function Forgot() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const next = async () => { try { setError(null); await api.post('/auth/password/forgot', { phone }); setStep(2); } catch (e) { setError(msg(e)); } };
  const done = async () => { try { setError(null); await api.post('/auth/password/reset', { phone, code, password }); router.replace('/login'); } catch (e) { setError(msg(e)); } };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen gap={20}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={{ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron-left" size={24} /></Pressable>
        <H size={34}>Mot de passe oublié</H>
        {step === 1 ? (
          <>
            <B color={C.n[700]}>Saisissez votre numéro : nous vous envoyons un code pour choisir un nouveau mot de passe.</B>
            <Phone value={phone} onChange={setPhone} /><Err text={error} />
            <Btn label="Recevoir un code" onPress={next} disabled={normalizePhone(phone).length < 8} />
          </>
        ) : (
          <>
            <B color={C.n[700]}>Code envoyé au <B>+241 {normalizePhone(phone)}</B>.</B>
            <CodeBoxes value={code} onChange={setCode} />
            <Field label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
            <Rules rules={passwordRules(password)} /><Err text={error} />
            <Btn label="Enregistrer" onPress={done} disabled={code.length < 6 || !isPasswordValid(password)} />
          </>
        )}
      </Screen>
    </SafeAreaView>
  );
}
