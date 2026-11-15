import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { average, formatGrade } from '@sge/shared';
import { Avatar, B, Btn, Chips, Field, Header, Loading, Muted, Screen, Seg } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { C, F, R } from '@/theme';
import { ClassPicker } from './components/ClassPicker';
import { useClassPicker } from './use-class-picker';
import { NoClassNotice } from './components/NoClassNotice';
import { errorMessage } from './format';
import { ErrorNote, SuccessNote } from './components/Notices';

/** Saisie des notes d'une évaluation, par classe et par trimestre. */
export function GradesScreen() {
  const { send } = useSession();
  const { classes, current, selected, select, error: classError } = useClassPicker();
  const { data: roster, error } = useApi<{ id: string; name: string; initials: string }[]>(
    selected ? `/me/teacher/classes/${selected}/students` : null,
  );
  const [vals, setVals] = useState<Record<string, string>>({});
  const [label, setLabel] = useState('Interrogation n°1');
  const [coef, setCoef] = useState<string | null>('1');
  const [trim, setTrim] = useState<'T1' | 'T2' | 'T3'>('T1');
  const [saved, setSaved] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    setVals({});
    setSaved(null);
  }, [selected]);
  if (classes && !classes.length) return <NoClassNotice />;
  if (!roster || !current) return <Loading error={error ?? classError} />;
  const num = (v?: string) => (v === undefined || v === '' ? NaN : parseFloat(v.replace(',', '.')));
  const bad = (id: string) =>
    vals[id] !== undefined && vals[id] !== '' && !(num(vals[id]) >= 0 && num(vals[id]) <= 20);
  const filled = roster.map((r) => num(vals[r.id])).filter((n) => !Number.isNaN(n));
  const avg = average(filled);
  const publish = async () => {
    setProblem(null);
    const entries = roster
      .map((r) => ({ studentId: r.id, value: num(vals[r.id]), comment: '' }))
      .filter((e) => !Number.isNaN(e.value));
    try {
      const res = await send<{ published: number; alreadyPublished: number }>(
        'POST',
        '/me/teacher/grades',
        {
          classId: current.id,
          subject: current.subject,
          trimester: trim,
          label: label.trim(),
          coefficient: Number(coef),
          entries,
        },
      );
      const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
      const published = res.data?.published ?? entries.length;
      const already = res.data?.alreadyPublished ?? 0;
      setSaved(
        res.queued
          ? 'Notes gardées sur le téléphone ; elles seront publiées au retour du réseau.'
          : `${plural(published, 'note publiée', 'notes publiées')} : élèves et parents sont prévenus.${already ? ` ${plural(already, 'note était déjà publiée et reste inchangée', 'notes étaient déjà publiées et restent inchangées')}.` : ''}`,
      );
    } catch (e) {
      setProblem(errorMessage(e, 'Publication impossible.'));
    }
  };
  return (
    <Screen gap={14}>
      <Header
        title={`Nouvelle note · ${current.name}`}
        sub={`${current.subject} · ${TRIMS.find((t) => t.key === trim)!.label}`}
      />
      <ClassPicker classes={classes} selected={selected} onSelect={select} />
      <Field label="Évaluation" value={label} onChangeText={setLabel} />
      <View style={{ gap: 8 }}>
        <Muted size={13}>Coefficient</Muted>
        <Chips
          options={['1', '2', '3', '4'].map((k) => ({ key: k, label: k }))}
          value={coef}
          onChange={setCoef}
        />
      </View>
      <Seg
        value={trim}
        onChange={setTrim}
        options={TRIMS.map((t) => ({ key: t.key, label: t.label }))}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Muted>
          {filled.length} notes saisies sur {roster.length}
        </Muted>
        <Muted>
          Moyenne <B semi>{avg === null ? '–' : formatGrade(avg)}</B>
        </Muted>
      </View>
      {roster.map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar initials={r.initials} size={38} />
          <B style={{ flex: 1 }} numberOfLines={1}>
            {r.name}
          </B>
          <TextInput
            accessibilityLabel={`Note de ${r.name}`}
            value={vals[r.id] ?? ''}
            onChangeText={(t) => setVals((v) => ({ ...v, [r.id]: t }))}
            keyboardType="decimal-pad"
            placeholder="–"
            placeholderTextColor={C.n[500]}
            style={{
              width: 70,
              minHeight: 46,
              textAlign: 'center',
              borderWidth: 1,
              borderColor: bad(r.id) ? C.a[700] : vals[r.id] ? C.a[400] : C.divider,
              borderRadius: R.lg,
              fontFamily: F.heading,
              fontSize: 22,
              color: C.text,
            }}
          />
          <Muted size={13}>/20</Muted>
        </View>
      ))}
      {saved && <SuccessNote text={saved} />}
      <ErrorNote text={problem} />
      <Btn
        icon="send"
        label="Publier les notes"
        onPress={publish}
        disabled={!filled.length || !label.trim() || roster.some((r) => bad(r.id))}
      />
    </Screen>
  );
}

const TRIMS = [
  { key: 'T1', label: '1er trim.' },
  { key: 'T2', label: '2ème' },
  { key: 'T3', label: '3ème' },
] as const;
