import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ANNOUNCE_TEMPLATES, TASK_TYPES, average, formatGrade, type TaskType } from '@sge/shared';
import { Icon } from '@/components/icon';
import { Avatar, B, Bar, Btn, Card, Chips, Field, H, Header, Kicker, ListRow, Loading, Muted, Num, Pill, Screen, Seg, Toggle } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { C, F, R } from '@/theme';

const today = () => new Date().toISOString().slice(0, 10);
const Done = ({ text }: { text: string }) => <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: R.lg, backgroundColor: C.a[100], borderWidth: 1, borderColor: C.a[300] }}><Icon name="circle-check" size={18} color={C.a[800]} /><B size={13.5} color={C.a[800]} style={{ flex: 1 }}>{text}</B></View>;

export function Home() {
  const router = useRouter();
  const { user } = useSession();
  const { data: d, error } = useApi<{ nextLesson: { time: string; className: string; students: number }; currentTask: { title: string; className: string; due: string; done: number; total: number; doubts: number }; classes: { name: string; students: number; pct: number; alert?: string }[] }>('/me/teacher/home');
  const { data: notifs } = useApi<{ read: boolean }[]>('/notifications');
  if (!d) return <Loading error={error} />;
  const actions = [['calendar-check', 'Faire l’appel', '/prof/appel'], ['pen-line', 'Saisir des notes', '/prof/notes'], ['plus', 'Nouvelle tâche', '/prof/tache'], ['megaphone', 'Annonce', '/prof/annonce']] as const;
  return (
    <Screen gap={20}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}><H size={28}>Bonjour <H size={28} italic>M. {user?.name.split(' ').pop()}</H></H><Muted size={12.5}>Mathématiques · mardi 10 novembre</Muted></View>
        <Pressable onPress={() => router.push('/prof/notifications')} accessibilityRole="button" accessibilityLabel="Notifications" style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.divider, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={19} />{notifs?.some((n) => !n.read) && <View style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent }} />}
        </Pressable>
      </View>
      <Card tint style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View><Kicker>Prochain cours · {d.nextLesson.time}</Kicker><H size={30}>{d.nextLesson.className}</H></View><B color={C.a[800]}>{d.nextLesson.students} élèves</B></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {actions.map(([i, l, to]) => <Pressable key={l} onPress={() => router.push(to)} accessibilityRole="button" style={{ width: '48.5%', minHeight: 52, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: R.lg, borderWidth: 1, borderColor: C.a[400], backgroundColor: C.bg }}><Icon name={i} size={18} color={C.a[800]} /><Text style={{ fontFamily: F.headingSemi, fontSize: 16, color: C.a[800] }}>{l}</Text></Pressable>)}
        </View>
        <Pressable onPress={() => router.push('/prof/codes')} accessibilityRole="button" style={{ minHeight: 48, flexDirection: 'row', gap: 10, alignItems: 'center' }}><Icon name="qr-code" size={19} color={C.a[800]} /><B size={14} color={C.a[800]} style={{ flex: 1 }}>Codes d’invitation des parents</B><Icon name="chevron-right" size={18} color={C.a[800]} /></Pressable>
      </Card>
      <View style={{ gap: 10 }}><H size={22} semi>Tâches en cours</H>
        <ListRow onPress={() => router.push('/prof/suivi')} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Pill label={`Exercice · ${d.currentTask.className}`} /><Muted size={12}>{d.currentTask.due}</Muted></View>
          <H size={19} semi>{d.currentTask.title}</H><Bar pct={(d.currentTask.done / d.currentTask.total) * 100} /><Muted size={12.5}>{d.currentTask.done}/{d.currentTask.total} terminé</Muted>
          <View style={{ flexDirection: 'row', gap: 6 }}><Icon name="circle-help" size={15} color={C.a[700]} /><B size={13} color={C.a[800]}>{d.currentTask.doubts} élèves ont des doutes</B></View>
        </ListRow>
      </View>
      <View style={{ gap: 10 }}><H size={22} semi>Mes classes</H>
        {d.classes.map((c) => <Card key={c.name} style={{ gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><H size={20} semi>{c.name}</H><Muted>{c.students} élèves</Muted></View><Bar pct={c.pct} /><Muted size={12.5}>{c.pct} % des tâches faites</Muted>{c.alert && <View style={{ flexDirection: 'row', gap: 6 }}><Icon name="circle-alert" size={15} color={C.a[800]} /><B size={13} color={C.a[800]}>{c.alert}</B></View>}</Card>)}
      </View>
    </Screen>
  );
}

type RollRow = { studentId: string; name: string; initials: string; status: 'P' | 'A' | 'R' };
const JUST = ['Maladie', 'Raison familiale', 'Transport', 'Autre', 'Non justifié'];
export function Appel() {
  const { send } = useSession();
  const [date, setDate] = useState<'today' | 'yesterday'>('today');
  const { data, error, setData } = useApi<RollRow[]>(`/me/teacher/attendance?classId=3b&date=${date}`);
  const [just, setJust] = useState<Record<string, string>>({});
  const [openJust, setOpenJust] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  if (!data) return <Loading error={error} />;
  const set = (id: string, status: RollRow['status']) => setData(data.map((r) => (r.studentId === id ? { ...r, status } : r)));
  const count = (s: string) => data.filter((r) => r.status === s).length;
  const save = async () => {
    const entries = data.map((r) => ({ studentId: r.studentId, status: r.status, justification: r.status !== 'P' && just[r.studentId] && just[r.studentId] !== 'Non justifié' ? just[r.studentId] : undefined }));
    const res = await send('POST', '/me/teacher/attendance', { classId: '3b', date: date === 'today' ? today() : 'hier', entries });
    setSaved(res.queued ? 'Appel gardé sur le téléphone. Il partira dès le retour du réseau.' : 'Appel enregistré. Les parents des absents et retardataires sont prévenus.');
  };
  return (
    <Screen gap={14}>
      <Header title="Appel · 3ème B" sub={`${date === 'today' ? 'Aujourd’hui' : 'Hier'} · 10 h – 12 h`} />
      <Seg value={date} onChange={setDate} options={[{ key: 'today', label: 'Aujourd’hui', icon: 'calendar' }, { key: 'yesterday', label: 'Hier', icon: 'calendar-days' }]} />
      <View style={{ flexDirection: 'row', gap: 8 }}>{[['P', 'présents'], ['A', 'absents'], ['R', 'en retard']].map(([k, l]) => <Card key={k} style={{ flex: 1, alignItems: 'center', padding: 10 }}><Num size={28}>{count(k!)}</Num><Muted size={12}>{l}</Muted></Card>)}</View>
      <Btn variant="secondary" size="md" icon="check-check" label="Tout le monde est présent" onPress={() => setData(data.map((r) => ({ ...r, status: 'P' })))} />
      {data.map((r) => (
        <View key={r.studentId} style={{ borderBottomWidth: 1, borderBottomColor: C.divider, paddingBottom: 8, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar initials={r.initials} size={38} /><B style={{ flex: 1 }} numberOfLines={1}>{r.name}</B>
            {(['P', 'A', 'R'] as const).map((k) => <Pressable key={k} onPress={() => set(r.studentId, k)} accessibilityRole="radio" accessibilityLabel={`${r.name} : ${{ P: 'présent', A: 'absent', R: 'en retard' }[k]}`} accessibilityState={{ selected: r.status === k }} style={{ width: 44, height: 44, borderRadius: R.lg, borderWidth: 1, borderColor: r.status === k ? C.accent : C.divider, backgroundColor: r.status === k ? (k === 'P' ? C.a[100] : C.a[200]) : 'transparent', alignItems: 'center', justifyContent: 'center' }}><B semi color={r.status === k ? C.a[800] : C.n[600]}>{k}</B></Pressable>)}
          </View>
          {r.status !== 'P' && (
            <View style={{ marginLeft: 48, gap: 6 }}>
              <Btn variant="link" label={just[r.studentId] && just[r.studentId] !== 'Non justifié' ? `Justifié : ${just[r.studentId]!.toLowerCase()}` : 'Ajouter une justification'} onPress={() => setOpenJust(openJust === r.studentId ? null : r.studentId)} />
              {openJust === r.studentId && <Chips options={JUST.map((j) => ({ key: j, label: j }))} value={just[r.studentId] ?? 'Non justifié'} onChange={(j) => { setJust((x) => ({ ...x, [r.studentId]: j })); setOpenJust(null); }} />}
            </View>
          )}
        </View>
      ))}
      {saved && <Done text={saved} />}
      <Btn label="Enregistrer l’appel" onPress={save} />
      <Muted size={12.5} style={{ textAlign: 'center' }}>Les parents des élèves absents ou en retard seront prévenus.</Muted>
    </Screen>
  );
}

const NOTE_NAMES = ['Aïcha Ondo', 'Brice Nzé', 'Cyrielle Mba', 'Daniel Obiang', 'Emmanuella Moussavou', 'Fabrice Mintsa', 'Grâce Nguema', 'Hervé Mabika'];
export function Notes() {
  const { send } = useSession();
  const [vals, setVals] = useState<Record<number, string>>({ 0: '15,5', 1: '12', 2: '17', 4: '9,5', 5: '13' });
  const [saved, setSaved] = useState<string | null>(null);
  const num = (v?: string) => (v === undefined || v === '' ? NaN : parseFloat(v.replace(',', '.')));
  const bad = (i: number) => vals[i] !== undefined && vals[i] !== '' && !(num(vals[i]) >= 0 && num(vals[i]) <= 20);
  const filled = NOTE_NAMES.map((_, i) => num(vals[i])).filter((n) => !Number.isNaN(n));
  const avg = average(filled);
  const publish = async () => {
    const entries = NOTE_NAMES.map((_, i) => ({ studentId: `s${i + 1}`, value: num(vals[i]), comment: '' })).filter((e) => !Number.isNaN(e.value));
    const res = await send('POST', '/me/teacher/grades', { classId: '3b', subject: 'Mathématiques', trimester: 'T1', label: 'Interrogation n°2', coefficient: 2, entries });
    setSaved(res.queued ? 'Notes gardées sur le téléphone ; elles seront publiées au retour du réseau.' : 'Notes publiées : élèves et parents sont prévenus.');
  };
  return (
    <Screen gap={14}>
      <Header title="Nouvelle note · 3ème B" sub="Mathématiques · 1er trimestre" />
      <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1.4 }}><Card><Muted size={12}>Évaluation</Muted><B>Interrogation n°2</B></Card></View><View style={{ flex: 1 }}><Card><Muted size={12}>Coefficient</Muted><B>2</B></Card></View></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Muted>{filled.length} notes saisies sur {NOTE_NAMES.length}</Muted><Muted>Moyenne <B semi>{avg === null ? '–' : formatGrade(avg)}</B></Muted></View>
      {NOTE_NAMES.map((n, i) => (
        <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar initials={n.split(' ').map((p) => p[0]).join('')} size={38} /><B style={{ flex: 1 }} numberOfLines={1}>{n}</B>
          <TextInput accessibilityLabel={`Note de ${n}`} value={vals[i] ?? ''} onChangeText={(t) => setVals((v) => ({ ...v, [i]: t }))} keyboardType="decimal-pad" placeholder="–" placeholderTextColor={C.n[500]} style={{ width: 70, minHeight: 46, textAlign: 'center', borderWidth: 1, borderColor: bad(i) ? C.a[700] : vals[i] ? C.a[400] : C.divider, borderRadius: R.lg, fontFamily: F.heading, fontSize: 22, color: C.text }} />
          <Muted size={13}>/20</Muted>
        </View>
      ))}
      {saved && <Done text={saved} />}
      <Btn icon="send" label="Publier les notes" onPress={publish} disabled={!filled.length || NOTE_NAMES.some((_, i) => bad(i))} />
    </Screen>
  );
}

const TYPE_HELP: Record<TaskType, { hint: string; icon: string; desc: string; due: string; est: string }> = {
  Cours: { hint: 'Support à lire ou à regarder. L’élève le marque comme lu ; ni note ni preuve demandée.', icon: 'book-open', desc: 'Résumé du cours', due: 'À lire avant', est: 'Durée de lecture' },
  Exercice: { hint: 'Entraînement : l’élève lance le minuteur, puis s’auto-évalue (« J’ai compris » / « J’ai des doutes »).', icon: 'pencil', desc: 'Consigne', due: 'À faire pour', est: 'Temps estimé' },
  Devoir: { hint: 'Travail à rendre : photo du devoir et, si vous le souhaitez, une note sur 20.', icon: 'file-check', desc: 'Sujet du devoir', due: 'À rendre le', est: 'Temps estimé' },
};
export function NouvelleTache() {
  const router = useRouter();
  const { send } = useSession();
  const [type, setType] = useState<TaskType>('Exercice');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('Demain');
  const [est, setEst] = useState<string | null>('30');
  const [photo, setPhoto] = useState(false);
  const [graded, setGraded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const h = TYPE_HELP[type];
  const publish = async () => {
    if (!title.trim()) return setError('Le titre est obligatoire.');
    try {
      await send('POST', '/me/teacher/tasks', { classId: '3b', subject: 'Mathématiques', type, title, description: desc, due, estimateMinutes: est ? Number(est) : undefined, requirePhoto: photo, graded: type === 'Devoir' && graded });
      router.replace('/prof');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Publication impossible.'); }
  };
  return (
    <Screen gap={16}>
      <Header title="Nouvelle tâche" sub="3ème B · Mathématiques" close />
      <Seg value={type} onChange={setType} options={TASK_TYPES.map((t) => ({ key: t, label: t, icon: TYPE_HELP[t].icon }))} />
      <Card tint style={{ flexDirection: 'row', gap: 10 }}><Icon name={h.icon} size={18} color={C.a[800]} /><B size={13.5} color={C.a[800]} style={{ flex: 1 }}>{h.hint}</B></Card>
      <Field label="Titre" value={title} onChangeText={(t) => { setTitle(t); setError(null); }} placeholder="Ex. Fractions : exercices 4 à 9" />
      <Field label={h.desc} value={desc} onChangeText={setDesc} multiline />
      <View style={{ gap: 8 }}><Muted size={13}>{h.due}</Muted><Chips options={['Aujourd’hui', 'Demain', 'Vendredi', 'Lundi'].map((d) => ({ key: d, label: d }))} value={due} onChange={setDue} /></View>
      <View style={{ gap: 8 }}><Muted size={13}>{h.est} · facultatif</Muted><Chips options={['15', '30', '45', '60'].map((m) => ({ key: m, label: `${m} min` }))} value={est} onChange={setEst} /></View>
      {type === 'Exercice' && <Toggle label="Demander une photo du cahier" sub="Facultatif pour l’élève" value={photo} onChange={setPhoto} />}
      {type === 'Devoir' && <><Toggle label="Photo du devoir obligatoire" sub="L’élève ne peut pas valider sans photo" value={photo} onChange={setPhoto} /><Toggle label="Devoir noté" sub="Ajoute une note sur 20 au bulletin" value={graded} onChange={setGraded} /></>}
      <View style={{ flexDirection: 'row', gap: 8 }}><Icon name="users" size={16} color={C.n[700]} /><Muted size={12.5}>38 élèves et leurs parents seront prévenus.</Muted></View>
      {error && <B color={C.a[800]}>{error}</B>}
      <Btn icon="send" label="Publier la tâche" onPress={publish} />
    </Screen>
  );
}

type Row = { index: number; name: string; initials: string; status: 'done' | 'doing' | 'none' | 'redo'; time: string; evaluation: '' | 'ok' | 'doubt'; proof: boolean };
const SV_LABEL = { done: 'Terminé', doing: 'En cours', none: 'Pas commencé', redo: 'À refaire' };
export function Suivi() {
  const router = useRouter();
  const { data, error, reload } = useApi<{ rows: Row[]; doubts: number }>('/me/teacher/tasks/k1/follow-up');
  const [f, setF] = useState<'all' | 'doubt' | 'todo'>('all');
  const [note, setNote] = useState<string | null>(null);
  if (!data) return <Loading error={error} />;
  const rows = data.rows.filter((r) => f === 'all' || (f === 'doubt' ? r.evaluation === 'doubt' : r.status === 'none' || r.status === 'redo'));
  const cnt = (s: Row['status']) => data.rows.filter((r) => r.status === s).length;
  const invalidate = async (r: Row) => { await api.post(`/me/teacher/tasks/k1/invalidate/${r.index}`); setNote(`Tâche renvoyée à ${r.name.split(' ')[0]}. Les 20 points sont annulés.`); void reload(); };
  return (
    <Screen gap={14}>
      <Header title="Fractions : exercices 4 à 9" sub="3ème B · à rendre aujourd’hui, 18 h" />
      <View style={{ flexDirection: 'row', gap: 8 }}>{([['done', 'terminé'], ['doing', 'en cours'], ['none', 'pas commencé']] as const).map(([k, l]) => <Card key={k} style={{ flex: 1, alignItems: 'center', padding: 10 }}><Num size={28}>{cnt(k)}</Num><Muted size={11.5}>{l}</Muted></Card>)}</View>
      <Card tint style={{ flexDirection: 'row', gap: 10 }}><Icon name="circle-help" size={18} color={C.a[800]} /><B size={13.5} color={C.a[800]} style={{ flex: 1 }}>{data.doubts} élèves ont des doutes. L’exercice 7 revient le plus souvent.</B></Card>
      <Seg value={f} onChange={setF} options={[{ key: 'all', label: 'Tous' }, { key: 'doubt', label: 'Doutes' }, { key: 'todo', label: 'À relancer' }]} />
      {note && <Done text={note} />}
      {rows.map((r) => (
        <Card key={r.index} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar initials={r.initials} size={38} /><B style={{ flex: 1 }}>{r.name}</B>
            {r.evaluation !== '' && <Icon name={r.evaluation === 'ok' ? 'smile' : 'circle-help'} size={18} color={C.a[700]} />}{r.proof && <Icon name="camera" size={18} color={C.a[700]} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Pill label={SV_LABEL[r.status]} /><Muted size={12}>{r.time}</Muted><View style={{ flex: 1 }} />
            {r.status === 'done' && <Btn variant="link" label="Invalider" onPress={() => invalidate(r)} />}
            <Btn variant="link" label="Signaler" onPress={() => router.push({ pathname: '/prof/signaler', params: { student: r.name } })} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

export function Signaler() {
  const router = useRouter();
  const student = useLocalSearchParams<{ student?: string }>().student ?? 'Brice Nzé';
  const [kind, setKind] = useState<'conduite' | 'confidentiel' | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const submit = async () => {
    try { await api.post('/me/teacher/reports', { studentId: 's2', kind, description: text }); setSent(kind === 'confidentiel' ? 'Signalement envoyé. Le référent est prévenu, sans le détail.' : 'Signalement envoyé à l’école.'); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Envoi impossible.'); }
  };
  return (
    <Screen gap={16}>
      <Header title="Signaler une situation" close />
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Avatar initials={student.split(' ').map((p) => p[0]).join('')} size={42} /><View><B semi>{student}</B><Muted size={12.5}>3ème B · Lycée Léon Mba</Muted></View></Card>
      {sent ? <><Done text={sent} /><Btn label="Retour au suivi" onPress={() => router.back()} /></> : (
        <>
          <View style={{ gap: 8 }}><Muted size={13}>De quoi s’agit-il ?</Muted>
            {([['conduite', 'flag', 'Conduite / engagement', 'Visible par l’école et éventuellement le parent'], ['confidentiel', 'shield', 'Confidentiel', 'Harcèlement, mal-être, difficulté personnelle']] as const).map(([k, i, l, d]) => (
              <Pressable key={k} onPress={() => { setKind(k); setError(null); }} accessibilityRole="radio" accessibilityState={{ selected: kind === k }} style={{ minHeight: 64, flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: R.lg, borderWidth: kind === k ? 1.5 : 1, borderColor: kind === k ? C.accent : C.divider, backgroundColor: kind === k ? C.a[100] : 'transparent' }}>
                <Icon name={i} size={22} color={C.a[700]} /><View style={{ flex: 1 }}><H size={19} semi>{l}</H><Muted size={12}>{d}</Muted></View>
              </Pressable>
            ))}
          </View>
          {kind && <><Field label="Décrivez la situation" value={text} onChangeText={setText} multiline placeholder="Les faits observés, quand et où." />
            <Card tint style={{ flexDirection: 'row', gap: 10 }}><Icon name={kind === 'confidentiel' ? 'lock' : 'eye'} size={17} color={C.a[800]} /><B size={13} color={C.a[800]} style={{ flex: 1 }}>{kind === 'confidentiel' ? 'Seuls le référent vie scolaire et le directeur verront le détail.' : 'L’école verra ce signalement ; le parent selon les réglages de l’école.'}</B></Card></>}
          {error && <B color={C.a[800]}>{error}</B>}
          <Btn label="Envoyer le signalement" onPress={submit} disabled={!kind || !text.trim()} />
        </>
      )}
    </Screen>
  );
}

export function Annonce() {
  const router = useRouter();
  const { send } = useSession();
  const [tpl, setTpl] = useState<string | null>('Évaluation');
  const [msg, setMsg] = useState(ANNOUNCE_TEMPLATES['Évaluation'] ?? '');
  const [sent, setSent] = useState<string | null>(null);
  const submit = async () => { const r = await send('POST', '/me/teacher/announcements', { message: msg, audience: 'class', target: '3ème B' }); setSent(r.queued ? 'Annonce gardée, elle partira au retour du réseau.' : 'Annonce envoyée. Élèves et parents sont notifiés.'); };
  return (
    <Screen gap={16}>
      <Header title="Annonce à la classe" sub="3ème B · 38 élèves et 61 parents" close />
      <View style={{ gap: 8 }}><Muted size={13}>Partir d’un modèle</Muted><Chips options={Object.keys(ANNOUNCE_TEMPLATES).map((k) => ({ key: k, label: k }))} value={tpl} onChange={(k) => { setTpl(k); setMsg(ANNOUNCE_TEMPLATES[k] ?? ''); }} /></View>
      <Field label="Message" value={msg} onChangeText={setMsg} multiline style={{ minHeight: 130 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}><Icon name="message-square" size={16} color={C.n[700]} /><Muted size={12.5}>Les parents sans smartphone la recevront par SMS.</Muted></View>
      {sent ? <><Done text={sent} /><Btn label="Retour" onPress={() => router.back()} /></> : <Btn icon="send" label="Envoyer à la classe" onPress={submit} disabled={!msg.trim()} />}
    </Screen>
  );
}

export function Codes() {
  const { data, error } = useApi<{ name: string; initials: string; code: string; linked: number; validUntil: string }[]>('/me/teacher/parent-codes');
  const [open, setOpen] = useState<number | null>(0);
  if (!data) return <Loading error={error} />;
  return (
    <Screen gap={12}>
      <Header title="Codes parents" sub="3ème B · générés par l’école" />
      <Card tint style={{ flexDirection: 'row', gap: 10 }}><Icon name="info" size={17} color={C.a[800]} /><B size={13.5} color={C.a[800]} style={{ flex: 1 }}>Montrez le QR code au parent ou dictez-lui le code. Chaque code rattache au plus 2 parents.</B></Card>
      {data.map((c, i) => (
        <View key={c.name} style={{ borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, overflow: 'hidden' }}>
          <Pressable onPress={() => setOpen(open === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: open === i }} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
            <Avatar initials={c.initials} size={40} /><View style={{ flex: 1 }}><B>{c.name}</B><Muted size={12}>{c.linked} / 2 parents rattachés</Muted></View><Num size={22} color={C.a[800]}>{c.code}</Num><Icon name={open === i ? 'chevron-up' : 'qr-code'} size={18} color={C.n[600]} />
          </Pressable>
          {open === i && <View style={{ alignItems: 'center', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: C.divider, backgroundColor: C.n[100] }}><View style={{ padding: 10, backgroundColor: '#fff', borderRadius: 4 }}><QRCode value={`sge://rattachement?code=${c.code.replace(/\s/g, '')}`} size={150} /></View><B semi>QR code · {c.code}</B><Muted size={12}>Valable jusqu’au {c.validUntil}</Muted></View>}
        </View>
      ))}
    </Screen>
  );
}
