import { useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { H } from '@/components/ui';
import { C, R } from '@/theme';

/** Saisie du code à 6 chiffres : un champ réel (clavier numérique, remplissage SMS) affiché en 6 cases. */
export function CodeBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      accessibilityLabel="Code à 6 chiffres"
      style={{ flexDirection: 'row', gap: 8 }}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 58,
            borderRadius: R.lg,
            borderWidth: 1,
            borderColor: value.length === i ? C.accent : C.divider,
            backgroundColor: value[i] ? C.a[100] : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <H size={30} style={{ fontVariant: ['tabular-nums'] }}>
            {value[i] ?? ''}
          </H>
        </View>
      ))}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
        autoFocus
      />
    </Pressable>
  );
}
