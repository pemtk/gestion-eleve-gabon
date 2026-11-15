import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { FAQ, SUPPORT, TIPS } from '@sge/shared';
import { Icon } from '@/components/icon';
import { B, Btn, Card, H, Header, Muted, Screen } from '@/components/ui';
import { C, R } from '@/theme';

/** Aide : questions fréquentes, conseils d'usage et contact du support. */
export function HelpScreen() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen gap={14}>
      <Header title="Aide" />
      <H size={22} semi>
        Questions fréquentes
      </H>
      {FAQ.map((q, i) => (
        <View
          key={q.q}
          style={{ borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, overflow: 'hidden' }}
        >
          <Pressable
            onPress={() => setOpen(open === i ? null : i)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open === i }}
            style={{
              minHeight: 56,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
            }}
          >
            <Icon name={q.icon} size={19} color={C.a[700]} />
            <B style={{ flex: 1 }}>{q.q}</B>
            <Icon name={open === i ? 'chevron-up' : 'chevron-down'} size={17} color={C.n[600]} />
          </Pressable>
          {open === i && (
            <View style={{ padding: 14, paddingTop: 0, gap: 8 }}>
              {q.a.map((l, n) => (
                <View key={n} style={{ flexDirection: 'row', gap: 10 }}>
                  <B size={13} color={C.a[700]}>
                    {n + 1}
                  </B>
                  <B size={13.5} style={{ flex: 1 }}>
                    {l}
                  </B>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
      <H size={22} semi>
        Nous contacter
      </H>
      <Card style={{ gap: 12 }}>
        {[
          ['mail', 'Email', SUPPORT.email],
          ['headset', 'Ligne prioritaire', SUPPORT.priorityLine],
          [
            'school',
            'Administration de l’école',
            'pour les notes, les comptes et les rattachements',
          ],
        ].map(([i, t, s]) => (
          <View key={t} style={{ flexDirection: 'row', gap: 12 }}>
            <Icon name={i!} size={19} color={C.a[700]} />
            <View style={{ flex: 1 }}>
              <B size={14}>{t}</B>
              <Muted size={12.5}>{s}</Muted>
            </View>
          </View>
        ))}
      </Card>
      <Btn
        icon="message-circle"
        label="Écrire au support"
        onPress={() => void Linking.openURL(`mailto:${SUPPORT.email}`)}
      />
      <Card tint style={{ gap: 8 }}>
        <H size={20} semi>
          Bonnes pratiques
        </H>
        {TIPS.map((t) => (
          <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
            <Icon name="check" size={16} color={C.a[700]} />
            <B size={13.5} style={{ flex: 1 }}>
              {t}
            </B>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
