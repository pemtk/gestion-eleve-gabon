import { Pressable, TextInput, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Muted } from '@/components/ui';
import { C, F } from '@/theme';

interface Props {
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  onPickImage: () => void;
  busy: boolean;
}

const CIRCLE = { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' } as const;

/** Zone de saisie : joindre une image, écrire, envoyer. */
export function Composer({ draft, onDraftChange, onSend, onPickImage, busy }: Props) {
  const canSend = !busy && draft.trim().length > 0;
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: C.divider,
      }}
    >
      <Pressable
        onPress={onPickImage}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Joindre une image"
        style={CIRCLE}
      >
        <Icon name="image" size={22} color={C.a[700]} />
      </Pressable>
      <TextInput
        value={draft}
        onChangeText={onDraftChange}
        onSubmitEditing={onSend}
        placeholder="Écrire un message…"
        placeholderTextColor={C.n[500]}
        accessibilityLabel="Message"
        maxLength={2000}
        style={{
          flex: 1,
          minHeight: 44,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: C.divider,
          borderRadius: 22,
          fontFamily: F.body,
          fontSize: 15,
          color: C.text,
        }}
      />
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Envoyer"
        style={{
          ...CIRCLE,
          borderRadius: 22,
          borderWidth: 1.5,
          borderColor: C.accent,
          backgroundColor: C.a[100],
          opacity: canSend ? 1 : 0.5,
        }}
      >
        <Icon name="send" size={19} color={C.a[800]} />
      </Pressable>
    </View>
  );
}

/** Remplace la zone de saisie dans un fil où l'utilisateur ne peut pas écrire (annonces aux parents…). */
export function ReadOnlyNotice() {
  return (
    <View
      style={{
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: C.divider,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <Icon name="lock" size={15} color={C.n[600]} />
      <Muted size={13}>Seuls les enseignants et la direction peuvent écrire ici.</Muted>
    </View>
  );
}
