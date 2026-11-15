import type { Message } from '@sge/shared';
import { View } from 'react-native';
import { Icon } from '@/components/icon';
import { RemoteImage } from '@/components/remote-image';
import { B, Muted } from '@/components/ui';
import { C, R } from '@/theme';

interface Props {
  message: Message;
  /** Fil de groupe : on affiche le nom de l'auteur au-dessus de ses messages. */
  showSender: boolean;
}

/** Une bulle de conversation : texte, image éventuelle, heure et état d'envoi. */
export function MessageBubble({ message, showSender }: Props) {
  const mine = message.mine;
  return (
    <View
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '82%',
        padding: 12,
        borderRadius: R.lg,
        backgroundColor: mine ? C.a[100] : C.n[100],
        borderWidth: 1,
        borderColor: mine ? C.a[300] : C.divider,
        gap: 4,
      }}
    >
      {!mine && showSender && message.sender && (
        <B size={12} semi color={C.a[800]}>
          {message.sender}
        </B>
      )}
      {message.fileId && (
        <RemoteImage fileId={message.fileId} size={180} style={{ width: 180, height: 140 }} />
      )}
      {message.text && <B size={14.5}>{message.text}</B>}
      <View style={{ flexDirection: 'row', gap: 5, alignSelf: 'flex-end', alignItems: 'center' }}>
        <Muted size={11}>{message.time}</Muted>
        {mine && <Icon name={message.pending ? 'clock' : 'check'} size={12} color={C.n[600]} />}
      </View>
    </View>
  );
}
