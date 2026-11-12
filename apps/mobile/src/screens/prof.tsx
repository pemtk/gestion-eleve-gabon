import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ANNOUNCE_TEMPLATES, TASK_TYPES, average, formatGrade, type TaskType } from '@sge/shared';
import { Icon } from '@/components/icon';
import { Avatar, B, Bar, Btn, Card, Chips, Field, H, Header, Kicker, ListRow, Loading, Muted, Num, Pill, Screen, Seg, Toggle } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { C, F, R } from '@/theme';

const isoDay = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const Done = ({ text }: { text: string }) => <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: R.lg, backgroundColor: C.a[100], borderWidth: 1, borderColor: C.a[300] }}><Icon name="circle-check" size={18} color={C.a[800]} /><B size={13.5} color={C.a[800]} style={{ flex: 1 }}>{text}</B></View>;
const Err = ({ text }: { text: string | null }) => (text ? <B color={C.a[800]}>{text}</B> : null);
const msg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

interface TeacherClass { id: string; name: string; subject: string; principal: boolean; students: number; pct: number }

/** Classes de l'enseignant (ses affectations) et choix de la classe active ; `?classId=` force la sélection. */
function useClassPicker() {
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  const { data, error } = useApi<TeacherClass[]>('/me/teacher/classes');
  const [picked, setPicked] = useState<string | null>(null);
  const selected = data?.find((c) => c.id === (picked ?? classId))?.id ?? data?.[0]?.id ?? null;
  const current = data?.find((c) => c.id === selected) ?? null;
  const picker = data && data.length > 1 ? (
    <View style={{ gap: 8 }}><Muted size={13}>Classe</Muted><Chips options={data.map((c) => ({ key: c.id, label: c.name }))} value={selected} onChange={setPicked} /></View>
  ) : null;
  return { classes: data, current, selected, picker, error };
}
const NoClass = () => (
  <Screen><Header title="Aucune classe" /><B color={C.n[700]}>Aucune classe ne vous est encore affectée. Contactez l’administration de l’école.</B></Screen>
);

export function Home() {
  const router = useRouter();
  const { user } = useSession();
  const { data: d, error } = useApi<{ mainClass: TeacherClass | null; currentTask: { id: string; title: string; className: string; due: string; done: number; total: number; doubts: number } | null; classes: TeacherClass[] }>('/me/teacher/home');
  const { data: notifs } = useApi<{ read: boolean }[]>('/notifications');
  if (!d) return <Loading error={error} />;
  const cid = d.mainClass?.id ?? '';
  const actions = [['calendar-check', 'Faire l’appel', `/prof/appel?classId=${cid}`], ['pen-line', 'Saisir des notes', `/prof/notes?classId=${cid}`], ['plus', 'Nouvelle tâche', `/prof/tache?classId=${cid}`], ['megaphone', 'Annonce', `/prof/annonce?classId=${cid}`]] as const;
  return (
    <Screen gap={20}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}><H size={28}>Bonjour <H size={28} italic>{user?.name}</H></H><Muted size={12.5}>{[...new Set(d.classes.map((c) => c.subject))].join(', ') || 'Enseignant'}</Muted></View>
        <Pressable onPress={() => router.push('/prof/notifications')} accessibilityRole="button" accessibilityLabel="Notifications" style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.divider, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={19} />{notifs?.some((n) => !n.read) && <View style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent }} />}
        </Pressable>
      </View>
      {!d.mainClass ? <Card><B color={C.n[700]}>Aucune classe ne vous est encore affectée. Contactez l’administration de l’école.</B></Card> : (
        <Card tint style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View><Kicker>{d.mainClass.principal ? 'Classe principale' : 'Ma première classe'}</Kicker><H size={30}>{d.mainClass.name}</H></View><B color={C.a[800]}>{d.mainClass.students} élèves</B></View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {actions.map(([i, l, to]) => <Pressable key={l} onPress={() => router.push(to)} accessibilityRole="button" style={{ width: '48.5%', minHeight: 52, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: R.lg, borderWidth: 1, borderColor: C.a[400], backgroundColor: C.bg }}><Icon name={i} size={18} color={C.a[800]} /><Text style={{ fontFamily: F.headingSemi, fontSize: 16, color: C.a[800] }}>{l}</Text></Pressable>)}
          </View>
          <Pressable onPress={() => router.push(`/prof/codes?classId=${cid}`)} accessibilityRole="button" style={{ minHeight: 48, flexDirection: 'row', gap: 10, alignItems: 'center' }}><Icon name="qr-code" size={19} color={C.a[800]} /><B size={14} color={C.a[800]} style={{ flex: 1 }}>Codes d’invitation des parents</B><Icon name="chevron-right" size={18} color={C.a[800]} /></Pressable>
        </Card>
      )}
      {d.currentTask && (
        <View style={{ gap: 10 }}><H size={22} semi>Dernière tâche publiée</H>
          <ListRow onPress={() => router.push(`/prof/suivi?task=${d.currentTask!.id}`)} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Pill label={d.currentTask.className} /><Muted size={12}>{d.currentTask.due}</Muted></View>
            <H size={19} semi>{d.currentTask.title}</H><Bar pct={d.currentTask.total ? (d.currentTask.done / d.currentTask.total) * 100 : 0} /><Muted size={12.5}>{d.currentTask.done}/{d.currentTask.total} terminé</Muted>
            {d.currentTask.doubts > 0 && <View style={{ flexDirection: 'row', gap: 6 }}><Icon name="circle-help" size={15} color={C.a[700]} /><B size={13} color={C.a[800]}>{d.currentTask.doubts} élève{d.currentTask.doubts > 1 ? 's ont' : ' a'} des doutes</B></View>}
          </ListRow>
        </View>
      )}
      <View style={{ gap: 10 }}><H size={22} semi>Mes classes</H>
        {d.classes.map((c) => <Card key={c.id} style={{ gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><H size={20} semi>{c.name}</H><Muted>{c.students} élèves · {c.subject}</Muted></View><Bar pct={c.pct} /><Muted size={12.5}>{c.pct} % des tâches faites</Muted></Card>)}
      </View>
    </Screen>
  );
}

type RollRow = { studentId: string; name: string; initials: string; status: 'P' | 'A' | 'R'; justification: string | null };
const JUST = ['Maladie', 'Raison familiale', 'Transport', 'Autre', 'Non justifié'];
export function Appel() {
  const { send } = useSession();
  const { classes, current, selected, picker, error: classError } = useClassPicker();
  const [date, setDate] = useState<'today' | 'yesterday'>('today');
  const day = date === 'today' ? isoDay(0) : isoDay(-1);
  const { data, error, setData } = useApi<RollRow[]>(selected ? `/me/teacher/attendance?classId=${selected}&date=${day}` : null);
  const [just, setJust] = useState<Record<string, string>>({});
  const [openJust, setOpenJust] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => { setJust({}); setSaved(null); }, [selected, day]);
  if (classes && !classes.length) return <NoClass />;
  if (!data || !current) return <Loading error={error ?? classError} />;
  const justOf = (r: RollRow) => just[r.studentId] ?? r.justification ?? 'Non justifié';
  const set = (id: string, status: RollRow['status']) => setData(data.map((r) => (r.studentId === id ? { ...r, status } : r)));
  const count = (s: string) => data.filter((r) => r.status === s).length;
  const save = async () => {
    setProblem(null);
    const entries = data.map((r) => ({ studentId: r.studentId, status: r.status, justification: r.status !== 'P' && justOf(r) !== 'Non justifié' ? justOf(r) : undefined }));
    try {
      const res = await send('POST', '/me/teacher/attendance', { classId: current.id, date: day, entries });
      setSaved(res.queued ? 'Appel gardé sur le téléphone. Il partira dès le retour du réseau.' : 'Appel enregistré. Les parents des absents et retardataires sont prévenus.');
    } catch (e) { setProblem(msg(e, 'Enregistrement impossible.')); }
  };
  return (
    <Screen gap={14}>
      <Header title={`Appel · ${current.name}`} sub={`${date === 'today' ? 'Aujourd’hui' : 'Hier'} · ${current.subject}`} />
      {picker}
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
              <Btn variant="link" label={justOf(r) !== 'Non justifié' ? `Justifié : ${justOf(r).toLowerCase()}` : 'Ajouter une justification'} onPress={() => setOpenJust(openJust === r.studentId ? null : r.studentId)} />
              {openJust === r.studentId && <Chips options={JUST.map((j) => ({ key: j, label: j }))} value={justOf(r)} onChange={(j) => { setJust((x) => ({ ...x, [r.studentId]: j })); setOpenJust(null); }} />}
            </View>
          )}
        </View>
      ))}
      {saved && <Done text={saved} />}
      <Err text={problem} />
      <Btn label="Enregistrer l’appel" onPress={save} />
      <Muted size={12.5} style={{ textAlign: 'center' }}>Les parents des élèves absents ou en retard seront prévenus.</Muted>
    </Screen>
  );
}

const TRIMS = [{ key: 'T1', label: '1er trim.' }, { key: 'T2', label: '2ème' }, { key: 'T3', label: '3ème' }] as const;
export function Notes() {
  const { send } = useSession();
  const { classes, current, selected, picker, error: classError } = useClassPicker();
  const { data: roster, error } = useApi<{ id: string; name: string; initials: string }[]>(selected ? `/me/teacher/classes/${selected}/students` : null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [label, setLabel] = useState('Interrogation n°1');
  const [coef, setCoef] = useState<string | null>('1');
  const [trim, setTrim] = useState<'T1' | 'T2' | 'T3'>('T1');
  const [saved, setSaved] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => { setVals({}); setSaved(null); }, [selected]);
  if (classes && !classes.length) return <NoClass />;
  if (!roster || !current) return <Loading error={error ?? classError} />;
  const num = (v?: string) => (v === undefined || v === '' ? NaN : parseFloat(v.replace(',', '.')));
  const bad = (id: string) => vals[id] !== undefined && vals[id] !== '' && !(num(vals[id]) >= 0 && num(vals[id]) <= 20);
  const filled = roster.map((r) => num(vals[r.id])).filter((n) => !Number.isNaN(n));
  const avg = average(filled);
  const publish = async () => {
    setProblem(null);
    const entries = roster.map((r) => ({ studentId: r.id, value: num(vals[r.id]), comment: '' })).filter((e) => !Number.isNaN(e.value));
    try {
      const res = await send<{ published: number; alreadyPublished: number }>('POST', '/me/teacher/grades', { classId: current.id, subject: current.subject, trimester: trim, label: label.trim(), coefficient: Number(coef), entries });
      const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
      const published = res.data?.published ?? entries.length;
      const already = res.data?.alreadyPublished ?? 0;
      setSaved(res.queued ? 'Notes gardées sur le téléphone ; elles seront publiées au retour du réseau.' : `${plural(published, 'note publiée', 'notes publiées')} : élèves et parents sont prévenus.${already ? ` ${plural(already, 'note était déjà publiée et reste inchangée', 'notes étaient déjà publiées et restent inchangées')}.` : ''}`);
    } catch (e) { setProblem(msg(e, 'Publication impossible.')); }
  };
  return (
    <Screen gap={14}>
      <Header title={`Nouvelle note · ${current.name}`} sub={`${current.subject} · ${TRIMS.find((t) => t.key === trim)!.label}`} />
      {picker}
      <Field label="Évaluation" value={label} onChangeText={setLabel} />
      <View style={{ gap: 8 }}><Muted size={13}>Coefficient</Muted><Chips options={['1', '2', '3', '4'].map((k) => ({ key: k, label: k }))} value={coef} onChange={setCoef} /></View>
      <Seg value={trim} onChange={setTrim} options={TRIMS.map((t) => ({ key: t.key, label: t.label }))} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Muted>{filled.length} notes saisies sur {roster.length}</Muted><Muted>Moyenne <B semi>{avg === null ? '–' : formatGrade(avg)}</B></Muted></View>
      {roster.map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar initials={r.initials} size={38} /><B style={{ flex: 1 }} numberOfLines={1}>{r.name}</B>
          <TextInput accessibilityLabel={`Note de ${r.name}`} value={vals[r.id] ?? ''} onChangeText={(t) => setVals((v) => ({ ...v, [r.id]: t }))} keyboardType="decimal-pad" placeholder="–" placeholderTextColor={C.n[500]} style={{ width: 70, minHeight: 46, textAlign: 'center', borderWidth: 1, borderColor: bad(r.id) ? C.a[700] : vals[r.id] ? C.a[400] : C.divider, borderRadius: R.lg, fontFamily: F.heading, fontSize: 22, color: C.text }} />
          <Muted size={13}>/20</Muted>
        </View>
      ))}
      {saved && <Done text={saved} />}
      <Err text={problem} />
      <Btn icon="send" label="Publier les notes" onPress={publish} disabled={!filled.length || !label.trim() || roster.some((r) => bad(r.id))} />
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
  const { classes, current, picker, error: classError } = useClassPicker();
  const [type, setType] = useState<TaskType>('Exercice');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('Demain');
  const [est, setEst] = useState<string | null>('30');
  const [photo, setPhoto] = useState(false);
  const [graded, setGraded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  if (classes && !classes.length) return <NoClass />;
  if (!current) return <Loading error={classError} />;
  const h = TYPE_HELP[type];
  const publish = async () => {
    if (!title.trim()) return setError('Le titre est obligatoire.');
    try {
      await send('POST', '/me/teacher/tasks', { classId: current.id, subject: current.subject, type, title, description: desc, due, estimateMinutes: est ? Number(est) : undefined, requirePhoto: photo, graded: type === 'Devoir' && graded });
      router.replace('/prof');
    } catch (e) { setError(msg(e, 'Publication impossible.')); }
  };
  return (
    <Screen gap={16}>
      <Header title="Nouvelle tâche" sub={`${current.name} · ${current.subject}`} close />
      {picker}
      <Seg value={type} onChange={setType} options={TASK_TYPES.map((t) => ({ key: t, label: t, icon: TYPE_HELP[t].icon }))} />
      <Card tint style={{ flexDirection: 'row', gap: 10 }}><Icon name={h.icon} size={18} color={C.a[800]} /><B size={13.5} color={C.a[800]} style={{ flex: 1 }}>{h.hint}</B></Card>
      <Field label="Titre" value={title} onChangeText={(t) => { setTitle(t); setError(null); }} placeholder="Ex. Fractions : exercices 4 à 9" />
      <Field label={h.desc} value={desc} onChangeText={setDesc} multiline />
      <View style={{ gap: 8 }}><Muted size={13}>{h.due}</Muted><Chips options={['Aujourd’hui', 'Demain', 'Vendredi', 'Lundi'].map((d) => ({ key: d, label: d }))} value={due} onChange={setDue} /></View>
      <View style={{ gap: 8 }}><Muted size={13}>{h.est} · facultatif</Muted><Chips options={['15', '30', '45', '60'].map((m) => ({ key: m, label: `${m} min` }))} value={est} onChange={setEst} /></View>
      {type === 'Exercice' && <Toggle label="Demander une photo du cahier" sub="Facultatif pour l’élève" value={photo} onChange={setPhoto} />}
      {type === 'Devoir' && <><Toggle label="Photo du devoir obligatoire" sub="L’élève ne peut pas valider sans photo" value={photo} onChange={setPhoto} /><Toggle label="Devoir noté" sub="Ajoute une note sur 20 au bulletin" value={graded} onChange={setGraded} /></>}
      <View style={{ flexDirection: 'row', gap: 8 }}><Icon name="users" size={16} color={C.n[700]} /><Muted size={12.5}>{current.students} élèves de {current.name} et leurs parents seront prévenus.</Muted></View>
      <Err text={error} />
      <Btn icon="send" label="Publier la tâche" onPress={publish} />
    </Screen>
  );
}

type Row = { studentId: string; name: string; initials: string; status: 'done' | 'doing' | 'none' | 'redo'; time: string; evaluation: '' | 'ok' | 'doubt'; proof: boolean };
const SV_LABEL = { done: 'Terminé', doing: 'En cours', none: 'Pas commencé', redo: 'À refaire' };
export function Suivi() {
  const router = useRouter();
  const { task } = useLocalSearchParams<{ task?: string }>();
  const list = useApi<{ id: string }[]>('/me/teacher/tasks');
  const id = task ?? list.data?.[0]?.id ?? null;
  const { data, error, reload } = useApi<{ task: { id: string; title: string; due: string; className: string }; rows: Row[]; doubts: number }>(id ? `/me/teacher/tasks/${id}/follow-up` : null);
  const [f, setF] = useState<'all' | 'doubt' | 'todo'>('all');
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (list.data && !list.data.length && !task) return <Screen><Header title="Suivi des tâches" /><B color={C.n[700]}>Vous n’avez pas encore publié de tâche.</B><Btn label="Nouvelle tâche" icon="plus" onPress={() => router.push('/prof/tache')} /></Screen>;
  if (!data) return <Loading error={error ?? list.error} />;
  const rows = data.rows.filter((r) => f === 'all' || (f === 'doubt' ? r.evaluation === 'doubt' : r.status === 'none' || r.status === 'redo'));
  const cnt = (s: Row['status'][]) => data.rows.filter((r) => s.includes(r.status)).length;
  const invalidate = async (r: Row) => {
    setProblem(null);
    try { await api.post(`/me/teacher/tasks/${data.task.id}/invalidate/${r.studentId}`); setNote(`Tâche renvoyée à ${r.name.split(' ')[0]}. Les points sont annulés.`); void reload(); }
    catch (e) { setProblem(msg(e, 'Invalidation impossible.')); }
  };
  return (
    <Screen gap={14}>
      <Header title={data.task.title} sub={`${data.task.className} · à rendre ${data.task.due.toLowerCase()}`} />
      <View style={{ flexDirection: 'row', gap: 8 }}>{([['done', 'terminé', ['done']], ['doing', 'en cours', ['doing']], ['none', 'pas commencé', ['none', 'redo']]] as const).map(([k, l, st]) => <Card key={k} style={{ flex: 1, alignItems: 'center', padding: 10 }}><Num size={28}>{cnt([...st])}</Num><Muted size={11.5}>{l}</Muted></Card>)}</View>
      {data.doubts > 0 && <Card tint style={{ flexDirection: 'row', gap: 10 }}><Icon name="circle-help" size={18} color={C.a[800]} /><B size={13.5} color={C.a[800]} style={{ flex: 1 }}>{data.doubts} élève{data.doubts > 1 ? 's ont' : ' a'} des doutes sur cette tâche.</B></Card>}
      <Seg value={f} onChange={setF} options={[{ key: 'all', label: 'Tous' }, { key: 'doubt', label: 'Doutes' }, { key: 'todo', label: 'À relancer' }]} />
      {note && <Done text={note} />}
      <Err text={problem} />
      {rows.map((r) => (
        <Card key={r.studentId} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar initials={r.initials} size={38} /><B style={{ flex: 1 }}>{r.name}</B>
            {r.evaluation !== '' && <Icon name={r.evaluation === 'ok' ? 'smile' : 'circle-help'} size={18} color={C.a[700]} />}{r.proof && <Icon name="camera" size={18} color={C.a[700]} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Pill label={SV_LABEL[r.status]} /><Muted size={12}>{r.time}</Muted><View style={{ flex: 1 }} />
            {r.status === 'done' && <Btn variant="link" label="Invalider" onPress={() => invalidate(r)} />}
            <Btn variant="link" label="Signaler" onPress={() => router.push({ pathname: '/prof/signaler', params: { student: r.name, studentId: r.studentId } })} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

export function Signaler() {
  const router = useRouter();
  const { student, studentId } = useLocalSearchParams<{ student?: string; studentId?: string }>();
  const [kind, setKind] = useState<'conduite' | 'confidentiel' | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const name = student ?? 'Élève';
  const submit = async () => {
    try { await api.post('/me/teacher/reports', { studentId, kind, description: text }); setSent(kind === 'confidentiel' ? 'Signalement envoyé. Le référent est prévenu, sans le détail.' : 'Signalement envoyé à l’école.'); }
    catch (e) { setError(msg(e, 'Envoi impossible.')); }
  };
  return (
    <Screen gap={16}>
      <Header title="Signaler une situation" close />
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Avatar initials={name.split(' ').map((p) => p[0]).join('')} size={42} /><View><B semi>{name}</B><Muted size={12.5}>Élève de vos classes</Muted></View></Card>
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
          <Err text={error} />
          <Btn label="Envoyer le signalement" onPress={submit} disabled={!kind || !text.trim() || !studentId} />
        </>
      )}
    </Screen>
  );
}

export function Annonce() {
  const router = useRouter();
  const { send } = useSession();
  const { classes, current, picker, error: classError } = useClassPicker();
  const [tpl, setTpl] = useState<string | null>('Évaluation');
  const [message, setMessage] = useState(ANNOUNCE_TEMPLATES['Évaluation'] ?? '');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (classes && !classes.length) return <NoClass />;
  if (!current) return <Loading error={classError} />;
  const submit = async () => {
    setError(null);
    try {
      const r = await send<{ recipients: { students: number; parents: number } }>('POST', '/me/teacher/announcements', { classId: current.id, message });
      setSent(r.queued ? 'Annonce gardée, elle partira au retour du réseau.' : `Annonce envoyée à ${r.data?.recipients.students ?? current.students} élèves et ${r.data?.recipients.parents ?? 0} parents.`);
    } catch (e) { setError(msg(e, 'Envoi impossible.')); }
  };
  return (
    <Screen gap={16}>
      <Header title="Annonce à la classe" sub={`${current.name} · ${current.students} élèves`} close />
      {picker}
      <View style={{ gap: 8 }}><Muted size={13}>Partir d’un modèle</Muted><Chips options={Object.keys(ANNOUNCE_TEMPLATES).map((k) => ({ key: k, label: k }))} value={tpl} onChange={(k) => { setTpl(k); setMessage(ANNOUNCE_TEMPLATES[k] ?? ''); }} /></View>
      <Field label="Message" value={message} onChangeText={setMessage} multiline style={{ minHeight: 130 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}><Icon name="message-square" size={16} color={C.n[700]} /><Muted size={12.5}>Les parents sans smartphone la recevront par SMS.</Muted></View>
      <Err text={error} />
      {sent ? <><Done text={sent} /><Btn label="Retour" onPress={() => router.back()} /></> : <Btn icon="send" label="Envoyer à la classe" onPress={submit} disabled={!message.trim()} />}
    </Screen>
  );
}

export function Codes() {
  const { classes, current, selected, picker, error: classError } = useClassPicker();
  const { data, error } = useApi<{ studentId: string; name: string; initials: string; code: string; linked: number; validUntil: string }[]>(selected ? `/me/teacher/parent-codes?classId=${selected}` : null);
  const [open, setOpen] = useState<number | null>(0);
  if (classes && !classes.length) return <NoClass />;
  if (!data || !current) return <Loading error={error ?? classError} />;
  return (
    <Screen gap={12}>
      <Header title="Codes parents" sub={`${current.name} · générés par l’école`} />
      {picker}
      <Card tint style={{ flexDirection: 'row', gap: 10 }}><Icon name="info" size={17} color={C.a[800]} /><B size={13.5} color={C.a[800]} style={{ flex: 1 }}>Montrez le QR code au parent ou dictez-lui le code. Chaque code rattache au plus 2 parents.</B></Card>
      {data.map((c, i) => (
        <View key={c.studentId} style={{ borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, overflow: 'hidden' }}>
          <Pressable onPress={() => setOpen(open === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: open === i }} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
            <Avatar initials={c.initials} size={40} /><View style={{ flex: 1 }}><B>{c.name}</B><Muted size={12}>{c.linked} / 2 parents rattachés</Muted></View><Num size={22} color={C.a[800]}>{c.code}</Num><Icon name={open === i ? 'chevron-up' : 'qr-code'} size={18} color={C.n[600]} />
          </Pressable>
          {open === i && <View style={{ alignItems: 'center', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: C.divider, backgroundColor: C.n[100] }}><View style={{ padding: 10, backgroundColor: '#fff', borderRadius: 4 }}><QRCode value={`sge://rattachement?code=${c.code.replace(/\s/g, '')}`} size={150} /></View><B semi>QR code · {c.code}</B><Muted size={12}>Valable jusqu’au {c.validUntil}</Muted></View>}
        </View>
      ))}
    </Screen>
  );
}
