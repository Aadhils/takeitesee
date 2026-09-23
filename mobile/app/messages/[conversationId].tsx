import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  conversationCanCompose,
  conversationTitle,
  fetchConversation,
  fetchConversationSafety,
  sendConversationMessage,
  type ConversationDetail,
  type ConversationSafety,
  type MessageRow,
  type MessageWorkspace,
} from '../../lib/messages';
import { useAuth } from '../../providers/AuthProvider';

type ThreadState =
  | { status: 'loading'; conversation: null; messages: MessageRow[]; safety: ConversationSafety }
  | { status: 'ready'; conversation: ConversationDetail; messages: MessageRow[]; safety: ConversationSafety }
  | { status: 'error'; conversation: null; messages: MessageRow[]; safety: ConversationSafety; message: string };

const defaultSafety: ConversationSafety = { blocked_by_me: false, messaging_blocked: false };

export default function MessageThreadScreen() {
  const auth = useAuth();
  const params = useLocalSearchParams<{
    conversationId?: string | string[];
    workspace?: string | string[];
  }>();
  const conversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;
  const requestedWorkspace = Array.isArray(params.workspace) ? params.workspace[0] : params.workspace;
  const workspace: MessageWorkspace = requestedWorkspace === 'provider' ? 'provider' : 'customer';
  const [state, setState] = useState<ThreadState>({ status: 'loading', conversation: null, messages: [], safety: defaultSafety });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (auth.status !== 'signedIn' || !conversationId) return;
    if (!silent) setState((current) => ({ status: 'loading', conversation: null, messages: current.messages, safety: current.safety }));
    try {
      const [thread, safetyPayload] = await Promise.all([
        fetchConversation(conversationId),
        fetchConversationSafety(conversationId),
      ]);
      setState({
        status: 'ready',
        conversation: thread.conversation,
        messages: thread.messages ?? [],
        safety: safetyPayload.safety ?? defaultSafety,
      });
      setActionError('');
    } catch (error) {
      if (!silent) {
        setState({
          status: 'error',
          conversation: null,
          messages: [],
          safety: defaultSafety,
          message: error instanceof Error ? error.message : 'Unable to load conversation.',
        });
      }
    }
  }, [auth.status, conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.muted}>Checking your session…</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (auth.status === 'signedOut') return <Redirect href="/login" />;

  if (!conversationId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Conversation ID is missing.</Text>
          <Link href="/messages" style={styles.backLink}>Back to messages</Link>
        </View>
      </SafeAreaView>
    );
  }

  const conversation = state.status === 'ready' ? state.conversation : null;
  const canCompose = conversation ? conversationCanCompose(conversation, state.safety) : false;
  const contextSummary = useMemo(() => {
    if (!conversation) return '';
    if (conversation.conversation_kind === 'requirement') {
      return [conversation.requirement_reference, conversation.service_name, conversation.requirement_status].filter(Boolean).join(' · ');
    }
    if (conversation.conversation_kind === 'job_application') {
      return [conversation.business_name, conversation.application_status].filter(Boolean).join(' · ');
    }
    return [conversation.product_order_business_name, conversation.product_order_status].filter(Boolean).join(' · ');
  }, [conversation]);

  const send = async () => {
    const body = draft.trim();
    if (!conversation || !canCompose || !body || sending) return;
    setSending(true);
    setActionError('');
    try {
      await sendConversationMessage(conversation.id, body);
      setDraft('');
      await load(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.topRow}>
          <Link href={{ pathname: '/messages', params: { workspace } }} style={styles.backLink}>← Messages</Link>
          <Pressable onPress={() => void load()} style={styles.refreshButton}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.inlineStatus}><ActivityIndicator /><Text style={styles.muted}>Loading conversation…</Text></View>
        ) : null}
        {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}

        {conversation ? (
          <>
            <View style={styles.headerCard}>
              <Text style={styles.eyebrow}>{conversation.conversation_kind.replaceAll('_', ' ')}</Text>
              <Text style={styles.title}>{conversationTitle(conversation)}</Text>
              <Text style={styles.counterpart}>{conversation.counterpart_name}</Text>
              {contextSummary ? <Text style={styles.context}>{contextSummary}</Text> : null}
              <Text style={styles.statusText}>Conversation: {conversation.conversation_status}</Text>
            </View>

            <ScrollView style={styles.messageScroll} contentContainerStyle={styles.messageContent}>
              {state.messages.length === 0 ? <Text style={styles.muted}>No messages yet.</Text> : null}
              {state.messages.map((message) => (
                <View key={message.id} style={[styles.messageBubble, message.is_mine ? styles.mineBubble : styles.theirBubble]}>
                  <Text style={styles.sender}>{message.is_mine ? 'You' : message.sender_name}</Text>
                  <Text style={styles.messageBody}>{message.body}</Text>
                  <Text style={styles.timestamp}>{message.created_at}</Text>
                </View>
              ))}
            </ScrollView>

            {state.safety.messaging_blocked ? (
              <View style={styles.blockedCard}>
                <Text style={styles.blockedTitle}>Messaging is blocked for this conversation</Text>
                <Text style={styles.muted}>Message history stays visible. Block/unblock controls remain outside this native slice.</Text>
              </View>
            ) : conversation.conversation_status !== 'open' ? (
              <View style={styles.readOnlyCard}>
                <Text style={styles.readOnlyTitle}>Conversation closed</Text>
                <Text style={styles.muted}>Message history remains available, but new messages are disabled.</Text>
              </View>
            ) : !canCompose ? (
              <View style={styles.readOnlyCard}>
                <Text style={styles.readOnlyTitle}>Messaging is not active for this workflow state</Text>
                <Text style={styles.muted}>The server context must allow messaging before the native composer becomes available.</Text>
              </View>
            ) : (
              <View style={styles.composer}>
                {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Write a message…"
                  multiline
                  maxLength={2000}
                  textAlignVertical="top"
                  style={styles.input}
                  editable={!sending}
                />
                <View style={styles.composerFooter}>
                  <Text style={styles.helper}>{draft.trim().length}/2000</Text>
                  <Pressable disabled={sending || !draft.trim()} onPress={() => void send()} style={[styles.sendButton, (sending || !draft.trim()) && styles.disabled]}>
                    {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Send</Text>}
                  </Pressable>
                </View>
              </View>
            )}
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  screen: { flex: 1, padding: 16, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  backLink: { fontSize: 13, fontWeight: '800', color: '#30304a' },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ededf4' },
  refreshText: { fontSize: 12, fontWeight: '800', color: '#3f3f58' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCard: { gap: 4, padding: 14, borderRadius: 14, backgroundColor: '#fff' },
  eyebrow: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1, color: '#77778a' },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: '#171721' },
  counterpart: { fontSize: 13, fontWeight: '800', color: '#444454' },
  context: { fontSize: 12, lineHeight: 18, color: '#77778a' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#666678' },
  messageScroll: { flex: 1 },
  messageContent: { gap: 8, paddingVertical: 4 },
  messageBubble: { maxWidth: '86%', gap: 4, padding: 11, borderRadius: 13 },
  mineBubble: { alignSelf: 'flex-end', backgroundColor: '#e8e8f2' },
  theirBubble: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  sender: { fontSize: 10, fontWeight: '800', color: '#666678' },
  messageBody: { fontSize: 14, lineHeight: 20, color: '#22222f' },
  timestamp: { fontSize: 9, color: '#888899' },
  blockedCard: { gap: 4, padding: 13, borderRadius: 12, backgroundColor: '#fff0f0' },
  blockedTitle: { fontSize: 13, fontWeight: '800', color: '#8b3535' },
  readOnlyCard: { gap: 4, padding: 13, borderRadius: 12, backgroundColor: '#f0f0f6' },
  readOnlyTitle: { fontSize: 13, fontWeight: '800', color: '#3d3d54' },
  composer: { gap: 8, padding: 12, borderRadius: 13, backgroundColor: '#fff' },
  input: { minHeight: 78, maxHeight: 140, borderWidth: 1, borderColor: '#d9d9e3', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10, fontSize: 14, color: '#171721' },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  helper: { fontSize: 10, color: '#77778a' },
  sendButton: { minWidth: 88, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#30304a' },
  sendText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  disabled: { opacity: 0.45 },
  muted: { fontSize: 13, lineHeight: 18, color: '#77778a' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
