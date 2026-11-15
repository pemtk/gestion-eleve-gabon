import { useState } from 'react';
import { Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Icon } from '@/components/icon';
import { Avatar, B, Card, Header, Loading, Muted, Num, Screen } from '@/components/ui';
import { useApi } from '@/lib/use-api';
import { C, R } from '@/theme';
import { ClassPicker } from './components/ClassPicker';
import { useClassPicker } from './use-class-picker';
import { NoClassNotice } from './components/NoClassNotice';

/** Codes d'invitation des parents d'une classe, et QR code à partager. */
export function ParentCodesScreen() {
  const { classes, current, selected, select, error: classError } = useClassPicker();
  const { data, error } = useApi<
    {
      studentId: string;
      name: string;
      initials: string;
      code: string;
      linked: number;
      validUntil: string;
    }[]
  >(selected ? `/me/teacher/parent-codes?classId=${selected}` : null);
  const [open, setOpen] = useState<number | null>(0);
  if (classes && !classes.length) return <NoClassNotice />;
  if (!data || !current) return <Loading error={error ?? classError} />;
  return (
    <Screen gap={12}>
      <Header title="Codes parents" sub={`${current.name} · générés par l’école`} />
      <ClassPicker classes={classes} selected={selected} onSelect={select} />
      <Card tint style={{ flexDirection: 'row', gap: 10 }}>
        <Icon name="info" size={17} color={C.a[800]} />
        <B size={13.5} color={C.a[800]} style={{ flex: 1 }}>
          Montrez le QR code au parent ou dictez-lui le code. Chaque code rattache au plus 2
          parents.
        </B>
      </Card>
      {data.map((c, i) => (
        <View
          key={c.studentId}
          style={{ borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, overflow: 'hidden' }}
        >
          <Pressable
            onPress={() => setOpen(open === i ? null : i)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open === i }}
            style={{
              minHeight: 60,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
            }}
          >
            <Avatar initials={c.initials} size={40} />
            <View style={{ flex: 1 }}>
              <B>{c.name}</B>
              <Muted size={12}>{c.linked} / 2 parents rattachés</Muted>
            </View>
            <Num size={22} color={C.a[800]}>
              {c.code}
            </Num>
            <Icon name={open === i ? 'chevron-up' : 'qr-code'} size={18} color={C.n[600]} />
          </Pressable>
          {open === i && (
            <View
              style={{
                alignItems: 'center',
                gap: 8,
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: C.divider,
                backgroundColor: C.n[100],
              }}
            >
              <View style={{ padding: 10, backgroundColor: '#fff', borderRadius: 4 }}>
                <QRCode value={`sge://rattachement?code=${c.code.replace(/\s/g, '')}`} size={150} />
              </View>
              <B semi>QR code · {c.code}</B>
              <Muted size={12}>Valable jusqu’au {c.validUntil}</Muted>
            </View>
          )}
        </View>
      ))}
    </Screen>
  );
}
