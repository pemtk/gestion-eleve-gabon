import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Avatar,
  B,
  Btn,
  Card,
  Chips,
  Header,
  Loading,
  Muted,
  Num,
  Screen,
  Seg,
} from '@/components/ui';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { C, R } from '@/theme';
import { ClassPicker } from './components/ClassPicker';
import { useClassPicker } from './use-class-picker';
import { NoClassNotice } from './components/NoClassNotice';
import { errorMessage } from './format';
import { ErrorNote, SuccessNote } from './components/Notices';

/** Appel de la classe : présent, absent ou en retard, avec justification (§6.5). */
export function AttendanceScreen() {
  const { send } = useSession();
  const { classes, current, selected, select, error: classError } = useClassPicker();
  const [date, setDate] = useState<'today' | 'yesterday'>('today');
  const day = date === 'today' ? isoDay(0) : isoDay(-1);
  const { data, error, setData } = useApi<RollRow[]>(
    selected ? `/me/teacher/attendance?classId=${selected}&date=${day}` : null,
  );
  const [just, setJust] = useState<Record<string, string>>({});
  const [openJust, setOpenJust] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    setJust({});
    setSaved(null);
  }, [selected, day]);
  if (classes && !classes.length) return <NoClassNotice />;
  if (!data || !current) return <Loading error={error ?? classError} />;
  const justOf = (r: RollRow) => just[r.studentId] ?? r.justification ?? 'Non justifié';
  const set = (id: string, status: RollRow['status']) =>
    setData(data.map((r) => (r.studentId === id ? { ...r, status } : r)));
  const count = (s: string) => data.filter((r) => r.status === s).length;
  const save = async () => {
    setProblem(null);
    const entries = data.map((r) => ({
      studentId: r.studentId,
      status: r.status,
      justification: r.status !== 'P' && justOf(r) !== 'Non justifié' ? justOf(r) : undefined,
    }));
    try {
      const res = await send('POST', '/me/teacher/attendance', {
        classId: current.id,
        date: day,
        entries,
      });
      setSaved(
        res.queued
          ? 'Appel gardé sur le téléphone. Il partira dès le retour du réseau.'
          : 'Appel enregistré. Les parents des absents et retardataires sont prévenus.',
      );
    } catch (e) {
      setProblem(errorMessage(e, 'Enregistrement impossible.'));
    }
  };
  return (
    <Screen gap={14}>
      <Header
        title={`Appel · ${current.name}`}
        sub={`${date === 'today' ? 'Aujourd’hui' : 'Hier'} · ${current.subject}`}
      />
      <ClassPicker classes={classes} selected={selected} onSelect={select} />
      <Seg
        value={date}
        onChange={setDate}
        options={[
          { key: 'today', label: 'Aujourd’hui', icon: 'calendar' },
          { key: 'yesterday', label: 'Hier', icon: 'calendar-days' },
        ]}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          ['P', 'présents'],
          ['A', 'absents'],
          ['R', 'en retard'],
        ].map(([k, l]) => (
          <Card key={k} style={{ flex: 1, alignItems: 'center', padding: 10 }}>
            <Num size={28}>{count(k!)}</Num>
            <Muted size={12}>{l}</Muted>
          </Card>
        ))}
      </View>
      <Btn
        variant="secondary"
        size="md"
        icon="check-check"
        label="Tout le monde est présent"
        onPress={() => setData(data.map((r) => ({ ...r, status: 'P' })))}
      />
      {data.map((r) => (
        <View
          key={r.studentId}
          style={{ borderBottomWidth: 1, borderBottomColor: C.divider, paddingBottom: 8, gap: 6 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar initials={r.initials} size={38} />
            <B style={{ flex: 1 }} numberOfLines={1}>
              {r.name}
            </B>
            {(['P', 'A', 'R'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => set(r.studentId, k)}
                accessibilityRole="radio"
                accessibilityLabel={`${r.name} : ${{ P: 'présent', A: 'absent', R: 'en retard' }[k]}`}
                accessibilityState={{ selected: r.status === k }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: R.lg,
                  borderWidth: 1,
                  borderColor: r.status === k ? C.accent : C.divider,
                  backgroundColor:
                    r.status === k ? (k === 'P' ? C.a[100] : C.a[200]) : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <B semi color={r.status === k ? C.a[800] : C.n[600]}>
                  {k}
                </B>
              </Pressable>
            ))}
          </View>
          {r.status !== 'P' && (
            <View style={{ marginLeft: 48, gap: 6 }}>
              <Btn
                variant="link"
                label={
                  justOf(r) !== 'Non justifié'
                    ? `Justifié : ${justOf(r).toLowerCase()}`
                    : 'Ajouter une justification'
                }
                onPress={() => setOpenJust(openJust === r.studentId ? null : r.studentId)}
              />
              {openJust === r.studentId && (
                <Chips
                  options={JUST.map((j) => ({ key: j, label: j }))}
                  value={justOf(r)}
                  onChange={(j) => {
                    setJust((x) => ({ ...x, [r.studentId]: j }));
                    setOpenJust(null);
                  }}
                />
              )}
            </View>
          )}
        </View>
      ))}
      {saved && <SuccessNote text={saved} />}
      <ErrorNote text={problem} />
      <Btn label="Enregistrer l’appel" onPress={save} />
      <Muted size={12.5} style={{ textAlign: 'center' }}>
        Les parents des élèves absents ou en retard seront prévenus.
      </Muted>
    </Screen>
  );
}

type RollRow = {
  studentId: string;
  name: string;
  initials: string;
  status: 'P' | 'A' | 'R';
  justification: string | null;
};

const JUST = ['Maladie', 'Raison familiale', 'Transport', 'Autre', 'Non justifié'];

const isoDay = (offset = 0) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
