import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatGrade } from '@/lib/format';
import { Icon } from '@/components/icon';
import { B, Card, H, Loading, Muted, Num, Screen } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { C, R } from '@/theme';

/** Résultats de l'élève par trimestre et par matière. */
export function ResultsScreen() {
  const [trim, setTrim] = useState('T1');
  const [open, setOpen] = useState<string | null>('Mathématiques');
  const { data: d, error } = useApi<{
    average: number | null;
    subjects: {
      subject: string;
      average: number;
      coefficient: number;
      notes: { label: string; value: number; meta: string; comment: string }[];
    }[];
  }>(`/me/student/results?trimester=${trim}`);
  return (
    <Screen gap={16}>
      <H size={34}>Mes résultats</H>
      <View
        style={{
          flexDirection: 'row',
          borderWidth: 1,
          borderColor: C.divider,
          borderRadius: R.lg,
          overflow: 'hidden',
        }}
      >
        {TRIMS.map((o, i) => (
          <Pressable
            key={o.k}
            onPress={() => setTrim(o.k)}
            accessibilityRole="tab"
            accessibilityState={{ selected: trim === o.k }}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: trim === o.k ? C.a[100] : 'transparent',
              borderLeftWidth: i ? 1 : 0,
              borderLeftColor: C.divider,
            }}
          >
            <B size={13.5} color={trim === o.k ? C.a[800] : C.text}>
              {o.l}
            </B>
          </Pressable>
        ))}
      </View>
      {!d ? (
        <Loading error={error} />
      ) : d.average === null ? (
        <View style={{ alignItems: 'center', gap: 8, padding: 30 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              borderWidth: 1,
              borderColor: C.a[400],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="hourglass" size={24} color={C.a[700]} />
          </View>
          <H size={22} semi>
            Pas encore de notes
          </H>
          <Muted style={{ textAlign: 'center' }}>
            Les notes apparaissent ici dès qu’un enseignant ou l’école les publie.
          </Muted>
        </View>
      ) : (
        <>
          <Card tint style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <H size={20} semi>
                Moyenne générale
              </H>
              <Muted size={12}>{d.subjects.length} matières · notes publiées</Muted>
            </View>
            <Num size={40} color={C.a[800]}>
              {formatGrade(d.average)}
              <Text style={{ fontSize: 18 }}>/20</Text>
            </Num>
          </Card>
          {d.subjects.map((s) => (
            <View
              key={s.subject}
              style={{
                borderWidth: 1,
                borderColor: C.divider,
                borderRadius: R.lg,
                overflow: 'hidden',
              }}
            >
              <Pressable
                onPress={() => setOpen(open === s.subject ? null : s.subject)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open === s.subject }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 14,
                  minHeight: 60,
                }}
              >
                <View style={{ flex: 1 }}>
                  <H size={19} semi>
                    {s.subject}
                  </H>
                  <Muted size={12}>
                    {s.notes.length} notes · coef. {s.coefficient}
                  </Muted>
                </View>
                <Num size={26}>{formatGrade(s.average)}</Num>
                <Icon
                  name={open === s.subject ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={C.n[600]}
                />
              </Pressable>
              {open === s.subject &&
                s.notes.map((n) => (
                  <View
                    key={n.label}
                    style={{
                      padding: 14,
                      borderTopWidth: 1,
                      borderTopColor: C.divider,
                      gap: 2,
                      backgroundColor: C.n[100],
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <B size={14}>{n.label}</B>
                      <Num size={22}>
                        {formatGrade(n.value)}
                        <Text style={{ fontSize: 13, color: C.n[600] }}>/20</Text>
                      </Num>
                    </View>
                    <Muted size={12}>{n.meta}</Muted>
                    <B size={13} italic color={C.n[800]}>
                      « {n.comment} »
                    </B>
                  </View>
                ))}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const TRIMS = [
  { k: 'T1', l: '1er trimestre' },
  { k: 'T2', l: '2ème' },
  { k: 'T3', l: '3ème' },
];
