import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { formatGrade, formatInt } from '@sge/shared';
import { Icon } from '@/components/icon';
import { Avatar, B, Bar, Btn, Card, H, Header, Hairline, ListRow, Loading, Muted, Num, Screen, SectionTitle, Seg, Toggle, Chips } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { C, F, R } from '@/theme';

type Kid = { id: string; name: string; initials: string; className: string; school: string; alert: boolean; status: string; icon: string };

export function Home() {
  const router = useRouter();
  const { user } = useSession();
  const { data, error } = useApi<Kid[]>('/me/parent/children');
  if (!data) return <Loading error={error} />;
  return (
    <Screen gap={20}>
      <View><H size={32}>Bonjour <H size={32} italic>{user?.name.split(' ').slice(-2).join(' ')}</H></H><B color={C.n[700]} style={{ marginTop: 6 }}>Voici vos enfants aujourd’hui.</B></View>
      {data.map((k) => (
        <ListRow key={k.id} onPress={() => router.push(`/parent/activite?kid=${k.id}`)} style={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Avatar initials={k.initials} size={54} />
            <View style={{ flex: 1 }}><H size={22} semi>{k.name}</H><Muted>{k.className}</Muted></View><Icon name="chevron-right" size={22} color={C.n[500]} />
          </View>
          <View style={{ padding: 13, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: C.divider, backgroundColor: k.alert ? C.a[100] : 'transparent', flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name={k.icon} size={20} color={k.alert ? C.a[800] : C.a[700]} /><B size={15} color={k.alert ? C.a[800] : C.text} style={{ flex: 1 }}>{k.status}</B>
          </View>
        </ListRow>
      ))}
      <Btn variant="secondary" icon="qr-code" label="Ajouter un enfant" onPress={() => router.push('/parent/ajouter')} style={{ borderStyle: 'dashed', borderColor: C.accent }} />
      <View style={{ gap: 10 }}>
        <H size={22} semi>Messages de l’école</H>
        <Card style={{ flexDirection: 'row', gap: 12 }}><Icon name="megaphone" size={20} color={C.a[700]} /><View style={{ flex: 1 }}><Muted size={12}>M. Ndong · 3ème B · il y a 2 h</Muted><B size={14.5}>Demain, évaluation de mathématiques sur le chapitre 3. Pensez à réviser.</B></View></Card>
      </View>
    </Screen>
  );
}

export function Activite() {
  const router = useRouter();
  const { kid } = useLocalSearchParams<{ kid?: string }>();
  // Sans enfant choisi (onglet « Activité »), on prend le premier enfant rattaché.
  const kids = useApi<Kid[]>('/me/parent/children');
  const id = kid ?? kids.data?.[0]?.id ?? null;
  const { data: d, error } = useApi<{ kid: { id: string; name: string; initials: string; className: string; school: string }; stats: { icon: string; value: string; label: string }[]; week: { day: string; minutes: number }[]; weekTotalLabel: string; reward: { label: string; threshold: number; points: number; left: number } | null; lastGrades: { subject: string; value: number }[] }>(id ? `/me/parent/children/${id}` : null);
  if (kids.data && !kids.data.length) {
    return (
      <Screen gap={16}>
        <H size={34}>Activité</H>
        <B color={C.n[700]}>Aucun enfant n’est encore rattaché à votre compte.</B>
        <Btn icon="qr-code" label="Ajouter un enfant" onPress={() => router.push('/parent/ajouter')} />
      </Screen>
    );
  }
  if (!d) return <Loading error={error ?? kids.error} />;
  const max = Math.max(...d.week.map((w) => w.minutes), 1);
  return (
    <Screen gap={18}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Avatar initials={d.kid.initials} size={44} /><View><H size={22} semi>{d.kid.name}</H><Muted size={12.5}>{d.kid.className} · {d.kid.school}</Muted></View></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {d.stats.map((s) => <Card key={s.label} style={{ width: '48%', gap: 2 }}><Icon name={s.icon} size={18} color={C.a[700]} /><Num size={30}>{s.value}</Num><Muted size={12.5}>{s.label}</Muted></Card>)}
      </View>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}><H size={22} semi>Temps de travail</H><Muted size={12.5}>cette semaine · {d.weekTotalLabel}</Muted></View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 110, borderBottomWidth: 1, borderBottomColor: C.divider }}>
          {d.week.map((w, i) => <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}><View accessibilityLabel={`${w.day} : ${w.minutes} minutes`} style={{ width: '100%', maxWidth: 26, height: `${Math.round((w.minutes / max) * 100)}%`, minHeight: 2, backgroundColor: w.minutes > 60 ? C.a[300] : C.a[100], borderWidth: 1, borderColor: C.a[400], borderBottomWidth: 0, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} /></View>)}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>{d.week.map((w, i) => <Muted key={i} size={11.5} style={{ flex: 1, textAlign: 'center' }}>{w.day}</Muted>)}</View>
      </View>
      {d.reward && (
        <View style={{ gap: 8 }}>
          <SectionTitle title="Récompense" action="Gérer les récompenses" onAction={() => router.push(`/parent/recompenses?kid=${d.kid.id}`)} />
          <Card tint style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}><H size={21} italic>{d.reward.label}</H><B size={13} color={C.a[800]}>{formatInt(d.reward.points)} / {formatInt(d.reward.threshold)}</B></View>
            <Bar pct={(d.reward.points / d.reward.threshold) * 100} /><B size={13} color={C.a[800]}>Plus que {formatInt(d.reward.left)} points. Nous vous préviendrons.</B>
          </Card>
        </View>
      )}
      <View><H size={22} semi style={{ marginBottom: 6 }}>Dernières notes</H>
        {d.lastGrades.map((g) => <View key={g.subject} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider }}><B style={{ flex: 1 }}>{g.subject}</B><Num size={26}>{formatGrade(g.value)}<Text style={{ fontSize: 14, color: C.n[600] }}>/20</Text></Num></View>)}</View>
      <Btn icon="message-circle" label="Écrire à l’enseignant" onPress={() => router.push('/parent/messages')} />
    </Screen>
  );
}

export function Alertes() {
  const { data, error, setData } = useApi<{ alerts: { icon: string; text: string; when: string; hot: boolean }[]; prefs: { id: string; label: string; on: boolean }[] }>('/me/parent/alerts');
  if (!data) return <Loading error={error} />;
  const toggle = async (id: string) => {
    const prefs = data.prefs.map((p) => (p.id === id ? { ...p, on: !p.on } : p));
    setData({ ...data, prefs });
    await api.put('/me/parent/alert-prefs', prefs.map(({ id, on }) => ({ id, on })));
  };
  return (
    <Screen gap={18}>
      <H size={34}>Alertes</H>
      {data.alerts.map((a) => (
        <Card key={a.text} tint={a.hot} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.a[400], alignItems: 'center', justifyContent: 'center' }}><Icon name={a.icon} size={18} color={C.a[700]} /></View>
          <View style={{ flex: 1 }}><B size={14.5}>{a.text}</B><Muted size={12}>{a.when}</Muted></View>
        </Card>
      ))}
      <View><H size={22} semi style={{ marginBottom: 4 }}>Me prévenir quand…</H>
        {data.prefs.map((p) => <View key={p.id}><Hairline /><Toggle label={p.label} value={p.on} onChange={() => void toggle(p.id)} /></View>)}</View>
    </Screen>
  );
}

const RELATIONS = ['père', 'mère', 'tuteur', 'tutrice'] as const;
export function Ajouter() {
  const router = useRouter();
  const [mode, setMode] = useState<'code' | 'qr'>('code');
  const [code, setCode] = useState('');
  const [rel, setRel] = useState<(typeof RELATIONS)[number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ status: 'active' | 'pending'; child: { name: string; className: string }; note: string } | null>(null);
  const ready = rel && (mode === 'qr' || code.length === 6);
  const submit = async () => {
    try { setError(null); setDone(await api.post('/me/parent/children/link', { mode, code: mode === 'code' ? code : undefined, relation: rel })); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Rattachement impossible.'); }
  };
  return (
    <Screen gap={18}>
      <Header title="Ajouter un enfant" />
      {done ? (
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 20 }}>
          <Avatar initials={done.child.name.split(' ').map((p) => p[0]).join('')} size={80} /><H size={26} semi>{done.child.name}</H><Muted>{done.child.className}</Muted>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Icon name={done.status === 'active' ? 'circle-check' : 'hourglass'} size={18} color={C.a[800]} /><B color={C.a[800]} semi>{done.status === 'active' ? 'Rattachement actif' : 'En attente de validation'}</B></View>
          <Muted style={{ textAlign: 'center' }}>{done.note}</Muted>
          <Btn label="Retour à l’accueil" onPress={() => router.replace('/parent')} style={{ marginTop: 10 }} />
        </View>
      ) : (
        <>
          <B color={C.n[700]}>L’école vous a remis un code à 6 chiffres ou un QR code.</B>
          <Seg value={mode} onChange={setMode} options={[{ key: 'code', label: 'Code à 6 chiffres', icon: 'hash' }, { key: 'qr', label: 'QR code', icon: 'qr-code' }]} />
          {mode === 'code' ? (
            <View style={{ gap: 7 }}>
              <TextInput accessibilityLabel="Code à 6 chiffres" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="······" placeholderTextColor={C.n[500]} style={{ minHeight: 64, textAlign: 'center', borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, fontFamily: F.heading, fontSize: 36, letterSpacing: 10, color: C.text }} />
              <Muted size={12.5}>Le code figure sur la fiche remise par l’école.</Muted>
            </View>
          ) : (
            <View style={{ height: 200, borderRadius: R.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.a[400], alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="scan-line" size={44} color={C.a[700]} /><Muted>caméra · visez le QR code</Muted></View>
          )}
          <View style={{ gap: 8 }}><Muted size={13}>Vous êtes</Muted><Chips options={RELATIONS.map((r) => ({ key: r, label: r }))} value={rel} onChange={setRel} /></View>
          {error && <B color={C.a[800]}>{error}</B>}
          <Btn label="Rattacher mon enfant" onPress={submit} disabled={!ready} />
        </>
      )}
    </Screen>
  );
}

export function Recompenses() {
  const { kid } = useLocalSearchParams<{ kid?: string }>();
  const { data, error, reload } = useApi<{ child: string | null; points: number; rewards: { id: string; label: string; threshold: number; reached: boolean; left: number }[] }>(kid ? `/me/parent/rewards/${kid}` : '/me/parent/rewards');
  const [label, setLabel] = useState('');
  const [threshold, setThreshold] = useState<string | null>('2000');
  if (!data) return <Loading error={error} />;
  const add = async () => { await api.post('/me/parent/rewards', { label, threshold: Number(threshold) }); setLabel(''); void reload(); };
  return (
    <Screen gap={16}>
      <Header title={data.child ? `Récompenses de ${data.child}` : 'Récompenses'} />
      <Card tint style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><B color={C.a[800]}>Points actuels</B><Num size={30} color={C.a[800]}>{formatInt(data.points)}</Num></Card>
      {data.rewards.map((r) => (
        <Card key={r.id} tint={r.reached} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><H size={20} semi>{r.label}</H><B size={13}>{formatInt(r.threshold)} pts</B></View>
          <Bar pct={(data.points / r.threshold) * 100} />
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Icon name={r.reached ? 'party-popper' : 'target'} size={15} color={C.a[700]} /><B size={13} color={C.a[800]}>{r.reached ? 'Seuil atteint : à vous de jouer !' : `Encore ${formatInt(r.left)} points`}</B></View>
        </Card>
      ))}
      <Card style={{ gap: 12 }}>
        <H size={20} semi>Nouvelle récompense</H>
        <TextInput accessibilityLabel="Nom de la récompense" value={label} onChangeText={setLabel} placeholder="Ex. Sortie au parc" placeholderTextColor={C.n[500]} style={{ minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, fontFamily: F.body, fontSize: 16, color: C.text }} />
        <Chips options={['500', '1000', '2000', '3000'].map((n) => ({ key: n, label: formatInt(Number(n)) }))} value={threshold} onChange={setThreshold} />
        <Btn icon="plus" label="Ajouter" onPress={add} disabled={!label.trim()} />
        <Muted size={12.5}>C’est vous qui offrez la récompense. L’application vous prévient quand le seuil est atteint.</Muted>
      </Card>
    </Screen>
  );
}
