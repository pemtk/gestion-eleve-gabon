import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { B } from '@/components/ui';
import { C, R } from '@/theme';

/** Message d'erreur d'un formulaire d'accès (rien si le message est vide). */
export const ErrorNote = ({ text }: { text: string | null }) =>
  text ? (
    <View
      accessibilityRole="alert"
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
      <Icon name="circle-alert" size={17} color={C.a[800]} />
      <B size={13.5} color={C.a[800]} style={{ flex: 1 }}>
        {text}
      </B>
    </View>
  ) : null;
