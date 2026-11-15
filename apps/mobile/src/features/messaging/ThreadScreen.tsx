import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { B, Header, Muted } from '@/components/ui';
import { C } from '@/theme';
import { Composer, ReadOnlyNotice } from './components/Composer';
import { MessageBubble } from './components/MessageBubble';
import { useThread } from './use-thread';

type Scrollable = { scrollToEnd: (options?: { animated?: boolean }) => void } | null;

/** Une conversation : messages (actualisés automatiquement), saisie ou mention « lecture seule ». */
export function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { summary, messages, error, busy, sendText, sendImage } = useThread(id);
  const [draft, setDraft] = useState('');
  const scroller = useRef<Scrollable>(null);
  const canPost = summary?.canPost !== false;

  const send = async () => {
    if (await sendText(draft)) setDraft('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
        <Header title={summary?.name ?? 'Conversation'} sub={summary?.kind} />
      </View>
      <ScrollView
        ref={(node) => {
          scroller.current = node as unknown as Scrollable;
        }}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 12, gap: 8 }}
      >
        {messages === null && !error && <Hint>Chargement…</Hint>}
        {messages?.length === 0 && (
          <Hint>Aucun message. {canPost ? 'Écrivez le premier !' : ''}</Hint>
        )}
        {(messages ?? []).map((message) => (
          <MessageBubble key={message.id} message={message} showSender={!!summary?.group} />
        ))}
      </ScrollView>
      {error && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
          <B size={13} color={C.a[800]}>
            {error}
          </B>
        </View>
      )}
      {canPost ? (
        <Composer
          draft={draft}
          onDraftChange={setDraft}
          onSend={send}
          onPickImage={sendImage}
          busy={busy}
        />
      ) : (
        <ReadOnlyNotice />
      )}
    </View>
  );
}

const Hint = ({ children }: { children: React.ReactNode }) => (
  <Muted size={13} style={{ textAlign: 'center' }}>
    {children}
  </Muted>
);
