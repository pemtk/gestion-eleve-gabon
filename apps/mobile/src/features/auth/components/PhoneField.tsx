import { TextInput, View } from 'react-native';
import { B, Muted } from '@/components/ui';
import { C, F, R } from '@/theme';

/** Champ de numéro de téléphone avec l'indicatif +241. */
export const PhoneField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => (
  <View style={{ gap: 7 }}>
    <Muted size={13}>Numéro de téléphone</Muted>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View
        style={{
          minHeight: 52,
          paddingHorizontal: 14,
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: C.divider,
          borderRadius: R.lg,
        }}
      >
        <B size={16}>+241</B>
      </View>
      <TextInput
        accessibilityLabel="Numéro de téléphone"
        value={value}
        onChangeText={onChange}
        keyboardType="phone-pad"
        placeholder="07 00 00 00"
        placeholderTextColor={C.n[500]}
        autoComplete="tel"
        style={{
          flex: 1,
          minHeight: 52,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: C.divider,
          borderRadius: R.lg,
          fontFamily: F.body,
          fontSize: 17,
          letterSpacing: 0.7,
          color: C.text,
        }}
      />
    </View>
  </View>
);
