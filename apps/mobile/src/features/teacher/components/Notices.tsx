import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { B } from '@/components/ui';
import { C, R } from '@/theme';

/** Messages de confirmation et d'erreur affichés sous un formulaire. */
export const SuccessNote = ({ text }: { text: string }) => (
  <View
    accessibilityLiveRegion="polite"
    style={{
      flexDirection: 'row',
      gap: 8,
      padding: 12,
      borderRadius: R.lg,
      backgroundColor: C.a[100],
      borderWidth: 1,
      borderColor: C.a[300],
    }}
  >
    <Icon name="circle-check" size={18} color={C.a[800]} />
    <B size={13.5} color={C.a[800]} style={{ flex: 1 }}>
      {text}
    </B>
  </View>
);

export const ErrorNote = ({ text }: { text: string | null }) =>
  text ? <B color={C.a[800]}>{text}</B> : null;
