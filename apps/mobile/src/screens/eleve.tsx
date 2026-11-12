import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatGrade, formatInt, formatTimer, type BadgeLike } from './types';
import { Icon } from '@/components/icon';
import { Avatar, B, Btn, Card, H, Header, Kicker, ListRow, Loading, Muted, Num, Pill, Ring, Screen, SectionTitle } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { useSession } from '@/lib/session';
import { C, F, R } from '@/theme';

type Task = { id: string; title: string; subject: string; type: string; due: string; status: 'todo' | 'doing' | 'done'; estimate: string };
const TASK_ICON = { todo: '', doing: 'clock', done: 'check' } as const;

export function Home() {
  const router = useRouter();
  const { user } = useSession();
  const { data: d, error } = useApi<{ points: number; streak: number; doneToday: number; dailyGoal: number; todayTasks: Task[]; lastGrades: { subject: string; value: number; comment: string }[] }>('/me/student/home');
  const { data: notifs } = useApi<{ read: boolean }[]>('/notifications');
  if (!d) return <Loading error={error} />;
  const unread = notifs?.some((n) => !n.read);
  return (
    <Screen gap={22}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar initials={user?.initials} />
        <View style={{ flex: 1 }}><H size={28}>Bonjour <H size={28} italic>{user?.name.split(' ')[0]}</H></H><Muted size={12.5}>3ème B{user?.organization ? ` · ${user.organization}` : ''}</Muted></View>
        <Pressable onPress={() => router.push('/eleve/notifications')} accessibilityRole="button" accessibilityLabel="Notifications" style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.divider, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={19} />{unread && <View style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, borderWidth: 2, borderColor: C.bg }} />}
        </Pressable>
      </View>
      <Pressable onPress={() => router.push('/eleve/trophees')} accessibilityRole="button" accessibilityLabel="Mes points" style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: R.lg, backgroundColor: C.a[100], borderWidth: 1, borderColor: C.a[300] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Kicker>Mes points</Kicker>
          <Num size={46} color={C.a[800]}>{formatInt(d.points)}</Num>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 }}><Icon name="flame" size={16} color={C.a[800]} /><B size={13} color={C.a[800]}>Série de {d.streak} jours</B></View>
        </View>
        <Ring pct={d.doneToday / d.dailyGoal}><Num size={24}>{d.doneToday}/{d.dailyGoal}</Num><B size={10} color={C.a[800]}>aujourd’hui</B></Ring>
      </Pressable>
      <View style={{ gap: 10 }}>
        <SectionTitle title="Aujourd’hui" action="Toutes mes tâches" onAction={() => router.push('/eleve/taches')} />
        {d.todayTasks.map((t) => <TaskRow key={t.id} t={t} />)}
      </View>
      <View style={{ gap: 10 }}>
        <SectionTitle title="Dernières notes" action="Tous mes résultats" onAction={() => router.push('/eleve/resultats')} />
        <View style={{ borderTopWidth: 1, borderTopColor: C.divider }}>
          {d.lastGrades.map((g) => (
            <View key={g.subject} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider }}>
              <View style={{ flex: 1 }}><B>{g.subject}</B><B size={12.5} italic color={C.n[700]}>« {g.comment} »</B></View>
              <Num size={28}>{formatGrade(g.value)}<Text style={{ fontSize: 15, color: C.n[600] }}>/20</Text></Num>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

function TaskRow({ t }: { t: Task }) {
  const router = useRouter();
  const done = t.status === 'done';
  return (
    <ListRow onPress={() => router.push(`/eleve/tache/${t.id}`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: t.status === 'todo' ? C.n[400] : C.accent, backgroundColor: done ? C.a[200] : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {TASK_ICON[t.status] ? <Icon name={TASK_ICON[t.status]} size={15} color={C.a[800]} /> : null}
      </View>
      <View style={{ flex: 1, gap: 4, opacity: done ? 0.55 : 1 }}>
        <B style={{ textDecorationLine: done ? 'line-through' : 'none' }}>{t.title}</B>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><Pill label={t.type} /><Muted size={12}>{t.subject} · {t.due}</Muted></View>
      </View>
      <Icon name="chevron-right" size={18} color={C.n[500]} />
    </ListRow>
  );
}

const FILTERS = [{ key: 'todo', label: 'À faire' }, { key: 'doing', label: 'En cours' }, { key: 'done', label: 'Terminées' }] as const;
export function Taches() {
  const [f, setF] = useState<'todo' | 'doing' | 'done'>('todo');
  const { data, error } = useApi<{ counts: Record<string, number>; tasks: Task[] }>('/me/student/tasks');
  if (!data) return <Loading error={error} />;
  const list = data.tasks.filter((t) => t.status === f);
  return (
    <Screen gap={16}>
      <H size={34}>Mes tâches</H>
      <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, overflow: 'hidden' }}>
        {FILTERS.map((o, i) => (
          <Pressable key={o.key} onPress={() => setF(o.key)} accessibilityRole="tab" accessibilityState={{ selected: f === o.key }} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: f === o.key ? C.a[100] : 'transparent', borderLeftWidth: i ? 1 : 0, borderLeftColor: C.divider }}>
            <B size={13.5} color={f === o.key ? C.a[800] : C.text}>{o.label} <B size={13.5} color={C.n[600]}>{data.counts[o.key]}</B></B>
          </Pressable>
        ))}
      </View>
      {list.map((t) => <BigTask key={t.id} t={t} />)}
      {!list.length && <H size={20} italic color={C.n[600]} style={{ textAlign: 'center', padding: 30 }}>Rien ici pour l’instant.</H>}
    </Screen>
  );
}
function BigTask({ t }: { t: Task }) {
  const router = useRouter();
  return (
    <ListRow onPress={() => router.push(`/eleve/tache/${t.id}`)} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Pill label={t.type} /><View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><Icon name="calendar" size={13} color={C.n[700]} /><Muted size={12}>{t.due}</Muted></View></View>
      <H size={19} semi>{t.title}</H>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Muted size={12.5}>{t.subject}</Muted><View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><Icon name="timer" size={13} color={C.n[700]} /><Muted size={12.5}>≈ {t.estimate}</Muted></View></View>
    </ListRow>
  );
}

/** §4.3 — lire la consigne, lancer le minuteur, mettre en pause, terminer. */
export function Tache() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: t, error } = useApi<Task & { teacher: string; instructions: string; resources: { kind: string; label: string; meta: string }[] }>(`/me/student/tasks/${id}`);
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => { if (!running) return; const i = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(i); }, [running]);
  if (!t) return <Loading error={error} />;
  return (
    <Screen gap={16}>
      <Header title="" right={<Pill label={`${t.type} · ${t.subject}`} />} />
      <H size={30} style={{ lineHeight: 33 }}>{t.title}</H>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
        {[['user', t.teacher], ['calendar', t.due], ['timer', `≈ ${t.estimate}`]].map(([i, l]) => <View key={l} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><Icon name={i!} size={14} color={C.n[700]} /><Muted size={12.5}>{l}</Muted></View>)}
      </View>
      <B size={14.5}>{t.instructions}</B>
      {t.resources.map((r) => (
        <View key={r.label} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderWidth: 1, borderColor: C.divider, borderRadius: R.lg }}>
          <Icon name={r.kind === 'pdf' ? 'file-text' : 'circle-play'} size={20} color={C.a[700]} />
          <View style={{ flex: 1 }}><B size={14}>{r.label}</B><Muted size={12}>{r.meta}</Muted></View>
          <Icon name={r.kind === 'pdf' ? 'download' : 'external-link'} size={18} color={C.n[600]} />
        </View>
      ))}
      <Card style={{ alignItems: 'center', gap: 16, paddingVertical: 20 }}>
        <Ring size={176} stroke={6} pct={sec / 1800}><Num size={50}>{formatTimer(sec)}</Num><Muted size={12}>{!started ? 'prêt à démarrer' : running ? 'au travail' : 'en pause'}</Muted></Ring>
        {!started ? <Btn label="Démarrer le travail" icon="play" onPress={() => { setStarted(true); setRunning(true); }} /> : (
          <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
            <View style={{ flex: 1 }}><Btn variant="secondary" label={running ? 'Pause' : 'Reprendre'} icon={running ? 'pause' : 'play'} onPress={() => setRunning((r) => !r)} /></View>
            <View style={{ flex: 1.4 }}><Btn label="J’ai terminé" icon="check" onPress={() => router.push({ pathname: '/eleve/autoeval', params: { id: t.id, sec: String(sec), title: t.title } })} /></View>
          </View>
        )}
        <Muted size={12} style={{ textAlign: 'center' }}>Prends le temps qu’il faut : une tâche bouclée trop vite peut être refusée par l’enseignant.</Muted>
      </Card>
    </Screen>
  );
}

export function AutoEval() {
  const { id, sec, title } = useLocalSearchParams<{ id: string; sec: string; title?: string }>();
  const router = useRouter();
  const { send } = useSession();
  const [choice, setChoice] = useState<'ok' | 'doubt' | null>(null);
  const [proof, setProof] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validate = async () => {
    if (!choice) return;
    setBusy(true);
    try {
      const res = await send<{ gained: number; points: number; streak: number; message: string }>('POST', `/me/student/tasks/${id}/complete`, { evaluation: choice, proof, seconds: Number(sec) });
      router.replace({ pathname: '/eleve/bravo', params: { gained: String(res.data?.gained ?? 20), points: String(res.data?.points ?? ''), streak: String(res.data?.streak ?? ''), queued: res.queued ? '1' : '', note: res.data?.message ?? '' } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); setBusy(false); }
  };
  return (
    <Screen gap={18}>
      <Header title="" close />
      <Kicker>{title ?? 'Tâche'} · {formatTimer(Number(sec) || 0)} de travail</Kicker>
      <H size={34}>Comment ça s’est passé ?</H>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {([['ok', 'smile', 'J’ai compris'], ['doubt', 'circle-help', 'J’ai des doutes']] as const).map(([k, icon, label]) => (
          <Pressable key={k} onPress={() => setChoice(k)} accessibilityRole="radio" accessibilityState={{ selected: choice === k }} style={{ flex: 1, minHeight: 132, padding: 16, borderRadius: R.lg, borderWidth: choice === k ? 1.5 : 1, borderColor: choice === k ? C.accent : C.divider, backgroundColor: choice === k ? C.a[100] : 'transparent', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Icon name={icon} size={34} color={C.a[700]} /><H size={19} semi style={{ textAlign: 'center' }}>{label}</H>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => setProof((p) => !p)} accessibilityRole="button" style={{ minHeight: 76, padding: 14, borderRadius: R.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: proof ? C.accent : C.a[400], flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.a[100], alignItems: 'center', justifyContent: 'center' }}><Icon name={proof ? 'circle-check' : 'camera'} size={20} color={C.a[800]} /></View>
        <View><B>{proof ? 'Photo ajoutée' : 'Ajouter une preuve'}</B><Muted size={12}>Facultatif · photo de ton cahier</Muted></View>
      </Pressable>
      {error && <B color={C.a[800]}>{error}</B>}
      <Btn label="Valider" onPress={validate} disabled={!choice || busy} />
    </Screen>
  );
}

export function Bravo() {
  const p = useLocalSearchParams<{ gained: string; points: string; streak: string; queued?: string; note?: string }>();
  const router = useRouter();
  return (
    <Screen gap={18}>
      <View style={{ alignItems: 'center', gap: 18, paddingTop: 30 }}>
        <View style={{ width: 132, height: 132, borderRadius: 66, borderWidth: 1.5, borderColor: C.accent, alignItems: 'center', justifyContent: 'center', shadowColor: C.a[300], shadowOpacity: 1, shadowRadius: 0 }}><Icon name="trophy" size={54} color={C.a[700]} /></View>
        <Num size={64} color={C.a[800]}>+{p.gained}</Num>
        <H size={28}>Bravo, tâche terminée !</H>
        <B color={C.n[700]} style={{ textAlign: 'center' }}>{p.queued ? 'Enregistré sur ton téléphone : il partira dès le retour du réseau.' : p.note}</B>
        {p.points ? (
          <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
            <Card style={{ flex: 1 }}><Num size={26}>{formatInt(Number(p.points))}</Num><Muted size={12}>points</Muted></Card>
            <Card style={{ flex: 1 }}><Num size={26}>{p.streak} j</Num><Muted size={12}>de série</Muted></Card>
          </View>
        ) : null}
        <Btn label="Retour à l’accueil" onPress={() => router.replace('/eleve')} />
      </View>
    </Screen>
  );
}

export function Trophees() {
  const { data: d, error } = useApi<{ points: number; streak: number; badges: { icon: string; label: string; earned: boolean }[]; history: { label: string; when: string; points: string }[] }>('/me/student/trophies');
  if (!d) return <Loading error={error} />;
  return (
    <Screen gap={20}>
      <Header title="Mes trophées" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card tint style={{ flex: 1 }}><Kicker>Total</Kicker><Num size={40} color={C.a[800]}>{formatInt(d.points)}</Num></Card>
        <Card style={{ flex: 1 }}><Kicker>Série</Kicker><Num size={40}>{d.streak} <Text style={{ fontSize: 18 }}>jours</Text></Num></Card>
      </View>
      <SectionTitle title="Badges" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
        {d.badges.map((b: BadgeLike) => (
          <View key={b.label} style={{ width: '33.33%', alignItems: 'center', gap: 7, opacity: b.earned ? 1 : 0.4 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: C.accent, backgroundColor: b.earned ? C.a[100] : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Icon name={b.icon} size={26} color={C.a[700]} /></View>
            <B size={12} style={{ textAlign: 'center' }}>{b.label}</B>
          </View>
        ))}
      </View>
      <SectionTitle title="Historique" />
      {d.history.map((h, i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.divider }}>
          <View style={{ flex: 1 }}><B size={14}>{h.label}</B><Muted size={12}>{h.when}</Muted></View><Text style={{ fontFamily: F.heading, fontSize: 20, color: C.a[800] }}>{h.points}</Text>
        </View>
      ))}
    </Screen>
  );
}

const TRIMS = [{ k: 'T1', l: '1er trimestre' }, { k: 'T2', l: '2ème' }, { k: 'T3', l: '3ème' }];
export function Resultats() {
  const [trim, setTrim] = useState('T1');
  const [open, setOpen] = useState<string | null>('Mathématiques');
  const { data: d, error } = useApi<{ average: number | null; subjects: { subject: string; average: number; coefficient: number; notes: { label: string; value: number; meta: string; comment: string }[] }[] }>(`/me/student/results?trimester=${trim}`);
  return (
    <Screen gap={16}>
      <H size={34}>Mes résultats</H>
      <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, overflow: 'hidden' }}>
        {TRIMS.map((o, i) => (
          <Pressable key={o.k} onPress={() => setTrim(o.k)} accessibilityRole="tab" accessibilityState={{ selected: trim === o.k }} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: trim === o.k ? C.a[100] : 'transparent', borderLeftWidth: i ? 1 : 0, borderLeftColor: C.divider }}>
            <B size={13.5} color={trim === o.k ? C.a[800] : C.text}>{o.l}</B>
          </Pressable>
        ))}
      </View>
      {!d ? <Loading error={error} /> : d.average === null ? (
        <View style={{ alignItems: 'center', gap: 8, padding: 30 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: C.a[400], alignItems: 'center', justifyContent: 'center' }}><Icon name="hourglass" size={24} color={C.a[700]} /></View>
          <H size={22} semi>Pas encore de notes</H><Muted style={{ textAlign: 'center' }}>Les notes apparaissent ici dès qu’un enseignant ou l’école les publie.</Muted>
        </View>
      ) : (
        <>
          <Card tint style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}><H size={20} semi>Moyenne générale</H><Muted size={12}>{d.subjects.length} matières · notes publiées</Muted></View>
            <Num size={40} color={C.a[800]}>{formatGrade(d.average)}<Text style={{ fontSize: 18 }}>/20</Text></Num>
          </Card>
          {d.subjects.map((s) => (
            <View key={s.subject} style={{ borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, overflow: 'hidden' }}>
              <Pressable onPress={() => setOpen(open === s.subject ? null : s.subject)} accessibilityRole="button" accessibilityState={{ expanded: open === s.subject }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 60 }}>
                <View style={{ flex: 1 }}><H size={19} semi>{s.subject}</H><Muted size={12}>{s.notes.length} notes · coef. {s.coefficient}</Muted></View>
                <Num size={26}>{formatGrade(s.average)}</Num><Icon name={open === s.subject ? 'chevron-up' : 'chevron-down'} size={18} color={C.n[600]} />
              </Pressable>
              {open === s.subject && s.notes.map((n) => (
                <View key={n.label} style={{ padding: 14, borderTopWidth: 1, borderTopColor: C.divider, gap: 2, backgroundColor: C.n[100] }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><B size={14}>{n.label}</B><Num size={22}>{formatGrade(n.value)}<Text style={{ fontSize: 13, color: C.n[600] }}>/20</Text></Num></View>
                  <Muted size={12}>{n.meta}</Muted><B size={13} italic color={C.n[800]}>« {n.comment} »</B>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}
