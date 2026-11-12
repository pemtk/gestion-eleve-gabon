import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Linking, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { FAQ, SUPPORT, TIPS, initials, isPasswordValid, passwordRules, type Message, type ThreadSummary } from '@sge/shared';
import { Icon } from '@/components/icon';
import { Avatar, B, Btn, Card, Field, H, Header, Kicker, ListRow, Loading, Muted, Rules, Screen, Seg } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { ROLE_PREFIX, useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { C, F, R } from '@/theme';

const usePrefix = () => ROLE_PREFIX[useSession().user?.role ?? 'eleve'] ?? '/eleve';

/* ---------------- Messagerie (§3.3) ---------------- */
export function Messages() {
  const router = useRouter();
  const prefix = usePrefix();
  const { data, error } = useApi<ThreadSummary[]>('/threads');
  if (!data) return <Loading error={error} />;
  return (
    <Screen gap={14}>
      <H size={34}>Messages</H>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 46, paddingHorizontal: 14, borderWidth: 1, borderColor: C.divider, borderRadius: R.lg }}><Icon name="search" size={17} color={C.n[600]} /><Muted size={14}>Rechercher une conversation</Muted></View>
      {data.map((t) => (
        <ListRow key={t.id} onPress={() => router.push(`${prefix}/thread/${t.id}` as '/')} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Avatar initials={t.initials} icon={t.icon} size={46} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><B semi={t.unread > 0}>{t.name}</B><Muted size={12}>{t.time}</Muted></View>
            <Muted size={12}>{t.kind}</Muted><B size={13.5} numberOfLines={1} color={t.unread ? C.text : C.n[700]}>{t.last}</B>
          </View>
          {t.unread > 0 && <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.a[200], alignItems: 'center', justifyContent: 'center' }}><B size={12} semi color={C.a[800]}>{t.unread}</B></View>}
        </ListRow>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Icon name="info" size={15} color={C.n[600]} /><Muted size={12}>Vous pouvez envoyer du texte et une image par message.</Muted></View>
    </Screen>
  );
}

export function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { send } = useSession();
  const { data, reload, setData } = useApi<Message[]>(`/threads/${id}/messages`);
  const [draft, setDraft] = useState('');
  const submit = async (text: string | null, image = false) => {
    const clientId = `c-${Date.now()}`;
    const optimistic: Message = { id: clientId, mine: true, text, image, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) };
    try {
      const res = await send('POST', `/threads/${id}/messages`, { text: text ?? undefined, image: image || undefined, clientId });
      setData((d) => [...(d ?? []), { ...optimistic, pending: res.queued }]);
      if (!res.queued) void reload();
    } catch { /* message refusé : le brouillon reste */ return; }
    setDraft('');
  };
  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!r.canceled) await submit(null, true);
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 4 }}><Header title="Conversation" /></View>
      <Screen gap={8}>
        <Muted size={12} style={{ textAlign: 'center' }}>Aujourd’hui</Muted>
        {(data ?? []).map((m) => (
          <View key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '82%', padding: 12, borderRadius: R.lg, backgroundColor: m.mine ? C.a[100] : C.n[100], borderWidth: 1, borderColor: m.mine ? C.a[300] : C.divider, gap: 4 }}>
            {m.image && <View style={{ width: 180, height: 110, borderRadius: 4, backgroundColor: C.n[300], alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={26} color={C.n[600]} /><Muted size={11}>photo</Muted></View>}
            {m.text && <B size={14.5}>{m.text}</B>}
            <View style={{ flexDirection: 'row', gap: 5, alignSelf: 'flex-end', alignItems: 'center' }}><Muted size={11}>{m.time}</Muted>{m.mine && <Icon name={m.pending ? 'clock' : 'check'} size={12} color={C.n[600]} />}</View>
          </View>
        ))}
      </Screen>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: C.divider }}>
        <Pressable onPress={pickImage} accessibilityRole="button" accessibilityLabel="Joindre une image" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={22} color={C.a[700]} /></Pressable>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Écrire un message…" placeholderTextColor={C.n[500]} accessibilityLabel="Message" onSubmitEditing={() => draft.trim() && submit(draft.trim())} style={{ flex: 1, minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: C.divider, borderRadius: 22, fontFamily: F.body, fontSize: 15, color: C.text }} />
        <Pressable onPress={() => draft.trim() && submit(draft.trim())} accessibilityRole="button" accessibilityLabel="Envoyer" style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: C.accent, backgroundColor: C.a[100], alignItems: 'center', justifyContent: 'center' }}><Icon name="send" size={19} color={C.a[800]} /></Pressable>
      </View>
    </View>
  );
}

/* ---------------- Notifications (§3.2) ---------------- */
export function Notifications() {
  const router = useRouter();
  const prefix = usePrefix();
  const { data, reload } = useApi<{ id: string; icon: string; text: string; when: string; target: string; read: boolean }[]>('/notifications');
  const open = (target: string) => router.push(`${prefix}${target.replace('/taches/', '/tache/')}` as '/');
  return (
    <Screen gap={12}>
      <Header title="Notifications" right={<Btn variant="link" label="Tout marquer comme lu" onPress={async () => { await api.post('/notifications/read-all'); void reload(); }} />} />
      {(data ?? []).map((n) => (
        <ListRow key={n.id} onPress={() => open(n.target)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: n.read ? 'transparent' : C.a[100] }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.a[400], alignItems: 'center', justifyContent: 'center' }}><Icon name={n.icon} size={18} color={C.a[700]} /></View>
          <View style={{ flex: 1 }}><B size={14.5}>{n.text}</B><Muted size={12}>{n.when}</Muted></View>
          {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent }} />}
        </ListRow>
      ))}
    </Screen>
  );
}

/* ---------------- Mon compte (§3.4) ---------------- */
export function Compte() {
  const router = useRouter();
  const prefix = usePrefix();
  const { user, signOut } = useSession();
  const [push, setPush] = useState(true);
  const kids = useApi<{ id: string; name: string; school: string }[]>(user?.role === 'parent' ? '/me/parent/children' : null);
  if (!user) return null;
  const parent = user.role === 'parent';
  const Item = ({ icon, label, value, onPress }: { icon: string; label: string; value?: string; onPress?: () => void }) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: C.divider }}>
      <Icon name={icon} size={19} color={C.a[700]} /><B style={{ flex: 1 }}>{label}</B>{value && <Muted size={12.5}>{value}</Muted>}<Icon name="chevron-right" size={17} color={C.n[500]} />
    </Pressable>
  );
  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ gap: 6 }}><Kicker>{title}</Kicker><View style={{ borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, overflow: 'hidden' }}>{children}</View></View>
  );
  const go = (p: string) => () => router.push(`${prefix}/${p}` as '/');
  return (
    <Screen gap={20}>
      <View style={{ alignItems: 'center', gap: 4, paddingTop: 6 }}>
        <Avatar initials={user.initials} size={72} /><H size={26} semi>{user.name}</H><Muted>+241 {user.phone.replace(/(\d{2})(?=\d)/g, '$1 ')}</Muted>
        <View style={{ paddingHorizontal: 10, paddingVertical: 2, borderRadius: 3, backgroundColor: C.a[100] }}><B size={12} color={C.a[800]}>{user.title}</B></View>
      </View>
      <Group title="Mon profil"><Item icon="user-pen" label="Nom et photo" onPress={go('profil')} /><Item icon="lock" label="Mot de passe" onPress={go('mot-de-passe')} /></Group>
      <Group title="Notifications">
        <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }}><Icon name="bell" size={19} color={C.a[700]} /><B style={{ flex: 1 }}>Notifications push</B>
          <Switch value={push} onValueChange={setPush} trackColor={{ true: C.a[300], false: C.n[300] }} thumbColor={push ? C.accent : C.n[500]} accessibilityLabel="Notifications push" /></View>
        {parent && <><Item icon="message-square" label="Relais SMS" value="activé par l’école" /><Item icon="sliders-horizontal" label="Choisir mes alertes" onPress={go('alertes')} /></>}
      </Group>
      <Group title="Établissements">{parent ? (kids.data ?? []).map((k) => <Item key={k.id} icon="school" label={k.school} value={k.name} />) : <Item icon="school" label={user.organization ?? 'Mon établissement'} value={user.role === 'enseignant' ? '3 classes' : '3ème B'} />}</Group>
      <Group title="Aide"><Item icon="life-buoy" label="Aide et questions fréquentes" onPress={go('aide')} /><Item icon="headset" label="Contacter le support" onPress={go('aide')} />
        <Item icon="shield" label="Confidentialité" onPress={() => void Linking.openURL(`mailto:${SUPPORT.email}?subject=Confidentialité`)} /></Group>
      <Btn variant="secondary" icon="log-out" label="Se déconnecter" onPress={signOut} />
      <Muted size={12} style={{ textAlign: 'center' }}>Version 1.0</Muted>
    </Screen>
  );
}

const VIS = [{ key: 'school', label: 'L’école', sub: 'Enseignants et administration' }, { key: 'teachers', label: 'Mes enseignants', sub: 'Seulement mes enseignants' }, { key: 'private', label: 'Personne', sub: 'Mes initiales à la place' }] as const;
export function ProfilEdit() {
  const router = useRouter();
  const { user } = useSession();
  const [first, setFirst] = useState(user?.name.split(' ')[0] ?? '');
  const [last, setLast] = useState(user?.name.split(' ').slice(1).join(' ') ?? '');
  const [vis, setVis] = useState<'school' | 'teachers' | 'private'>('school');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (!r.canceled) setPhoto(r.assets[0]?.uri ?? null);
  };
  const save = async () => {
    try { await api.put('/me/profile', { firstName: first, lastName: last, photoVisibility: vis }); router.back(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Enregistrement impossible.'); }
  };
  return (
    <Screen gap={18}>
      <Header title="Nom et photo" />
      <View style={{ alignItems: 'center', gap: 8 }}>
        {photo ? <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.n[300], alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={30} color={C.n[700]} /></View> : <Avatar initials={initials(`${first} ${last}`)} size={96} />}
        <Btn variant="link" label={photo ? 'Changer la photo' : 'Ajouter une photo'} onPress={pick} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Field label="Prénom" value={first} onChangeText={setFirst} /></View><View style={{ flex: 1 }}><Field label="Nom" value={last} onChangeText={setLast} /></View></View>
      <View style={{ gap: 8 }}><Muted size={13}>Qui peut voir ma photo ?</Muted>
        {VIS.map((o) => (
          <Pressable key={o.key} onPress={() => setVis(o.key)} accessibilityRole="radio" accessibilityState={{ selected: vis === o.key }} style={{ minHeight: 56, flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: R.lg, borderWidth: vis === o.key ? 1.5 : 1, borderColor: vis === o.key ? C.accent : C.divider, backgroundColor: vis === o.key ? C.a[100] : 'transparent' }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: C.accent, backgroundColor: vis === o.key ? C.accent : 'transparent' }} /><View><B>{o.label}</B><Muted size={12}>{o.sub}</Muted></View>
          </Pressable>
        ))}
      </View>
      <Muted size={12.5}>Le numéro de téléphone ne peut être changé que par l’école.</Muted>
      {error && <B color={C.a[800]}>{error}</B>}
      <Btn label="Enregistrer" onPress={save} disabled={!first.trim() || !last.trim()} />
    </Screen>
  );
}

export function MotDePasse() {
  const router = useRouter();
  const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [conf, setConf] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mismatch = conf.length > 0 && conf !== nw;
  const save = async () => {
    try { await api.post('/auth/password/change', { current: cur, next: nw, confirm: conf }); router.back(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Changement impossible.'); }
  };
  return (
    <Screen gap={16}>
      <Header title="Changer le mot de passe" />
      <Field label="Mot de passe actuel" value={cur} onChangeText={setCur} secureTextEntry />
      <Btn variant="link" label="Je ne m’en souviens plus" onPress={() => router.push('/forgot')} />
      <Field label="Nouveau mot de passe" value={nw} onChangeText={setNw} secureTextEntry /><Rules rules={passwordRules(nw)} />
      <Field label="Confirmer le nouveau mot de passe" value={conf} onChangeText={setConf} secureTextEntry />
      {mismatch && <View style={{ flexDirection: 'row', gap: 6 }}><Icon name="circle-alert" size={15} color={C.a[800]} /><B size={13} color={C.a[800]}>Les deux mots de passe ne sont pas identiques.</B></View>}
      {error && <B color={C.a[800]}>{error}</B>}
      <Btn label="Enregistrer" onPress={save} disabled={!cur || !isPasswordValid(nw) || nw !== conf} />
      <Muted size={12.5}>Vous restez connecté sur ce téléphone ; les autres appareils devront se reconnecter.</Muted>
    </Screen>
  );
}

export function Aide() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen gap={14}>
      <Header title="Aide" />
      <H size={22} semi>Questions fréquentes</H>
      {FAQ.map((q, i) => (
        <View key={q.q} style={{ borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, overflow: 'hidden' }}>
          <Pressable onPress={() => setOpen(open === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: open === i }} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <Icon name={q.icon} size={19} color={C.a[700]} /><B style={{ flex: 1 }}>{q.q}</B><Icon name={open === i ? 'chevron-up' : 'chevron-down'} size={17} color={C.n[600]} />
          </Pressable>
          {open === i && <View style={{ padding: 14, paddingTop: 0, gap: 8 }}>{q.a.map((l, n) => <View key={n} style={{ flexDirection: 'row', gap: 10 }}><B size={13} color={C.a[700]}>{n + 1}</B><B size={13.5} style={{ flex: 1 }}>{l}</B></View>)}</View>}
        </View>
      ))}
      <H size={22} semi>Nous contacter</H>
      <Card style={{ gap: 12 }}>
        {[['mail', 'Email', SUPPORT.email], ['headset', 'Ligne prioritaire', SUPPORT.priorityLine], ['school', 'Administration de l’école', 'pour les notes, les comptes et les rattachements']].map(([i, t, s]) => (
          <View key={t} style={{ flexDirection: 'row', gap: 12 }}><Icon name={i!} size={19} color={C.a[700]} /><View style={{ flex: 1 }}><B size={14}>{t}</B><Muted size={12.5}>{s}</Muted></View></View>
        ))}
      </Card>
      <Btn icon="message-circle" label="Écrire au support" onPress={() => void Linking.openURL(`mailto:${SUPPORT.email}`)} />
      <Card tint style={{ gap: 8 }}><H size={20} semi>Bonnes pratiques</H>{TIPS.map((t) => <View key={t} style={{ flexDirection: 'row', gap: 8 }}><Icon name="check" size={16} color={C.a[700]} /><B size={13.5} style={{ flex: 1 }}>{t}</B></View>)}</Card>
    </Screen>
  );
}
