import { Link, Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileNav } from '../components/MobileNav';
import {
  conversationTitle,
  fetchMessageInbox,
  type ConversationSummary,
  type MessageWorkspace,
} from '../lib/messages';
import { useAuth } from '../providers/AuthProvider';

type InboxState =
  | { status: 'loading'; conversations: ConversationSummary[] }
  | { status: 'ready'; conversations: ConversationSummary[] }
  | { status: 'error'; conversations: ConversationSummary[]; message: string };

export default function MessagesScreen() {
  const auth = useAuth();
  const providerAccess = auth.status === 'signedIn'
    && (auth.identity.roles.includes('professional') || auth.identity.roles.includes('business_owner'));
  const [workspace, setWorkspace] = useState<MessageWorkspace>('customer');
  const [state, setState] = useState<InboxState>({ status: 'loading', conversations: [] });

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn') return;
    const effectiveWorkspace = workspace === 'provider' && !providerAccess ? 'customer' : workspace;
    setState((current) => ({ status: 'loading', conversations: current.conversations }));
    try {
      const payload = await fetchMessageInbox(effectiveWorkspace);
      setState({ status: 'ready', conversations: payload.conversations ?? [] });
    } catch (error) {
      setState({
        status: 'error',
        conversations: [],
        message: error instanceof Error ? error.message : 'Unable to load messages.',
      });
    }
  }, [auth.status, providerAccess, workspace]);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(
    () => state.conversations.reduce((sum, row) => sum + Math.max(0, Number(row.unread_count || 0)), 0),
    [state.conversations],
  );

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

  const changeWorkspace = (next: MessageWorkspace) => {
    if (next === 'provider' && !providerAccess) return;
    setWorkspace(next);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>MESSAGES</Text>
              <Text style={styles.title}>Marketplace conversations</Text>
              <Text style={styles.description}>Threads stay scoped to the server-owned Customer or Provider workspace.</Text>
            </View>
            <Text style={styles.count}>{unreadCount}</Text>
          </View>

          {providerAccess ? (
            <View style={styles.workspaceRow}>
              <Pressable onPress={() => changeWorkspace('customer')} style={[styles.workspaceButton, workspace === 'customer' && styles.workspaceButtonActive]}>
                <Text style={[styles.workspaceText, workspace === 'customer' && styles.workspaceTextActive]}>Customer</Text>
              </Pressable>
              <Pressable onPress={() => changeWorkspace('provider')} style={[styles.workspaceButton, workspace === 'provider' && styles.workspaceButtonActive]}>
                <Text style={[styles.workspaceText, workspace === 'provider' && styles.workspaceTextActive]}>Provider</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable onPress={() => void load()} style={styles.refreshButton}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          {state.status === 'loading' ? <View style={styles.inlineStatus}><ActivityIndicator /><Text style={styles.muted}>Loading conversations…</Text></View> : null}
          {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}
          {state.status === 'ready' && state.conversations.length === 0 ? (
            <View style={styles.card}><Text style={styles.cardTitle}>No conversations yet</Text><Text style={styles.muted}>Marketplace conversations will appear here when a workflow opens one.</Text></View>
          ) : null}

          {state.conversations.map((row) => {
            const context = row.conversation_kind === 'requirement'
              ? [row.service_name, row.proposal_reference].filter(Boolean).join(' · ')
              : row.conversation_kind === 'job_application'
                ? ['Job application', row.application_status].filter(Boolean).join(' · ')
                : [row.product_order_business_name, row.product_order_quantity ? `Qty ${row.product_order_quantity}` : null].filter(Boolean).join(' · ');
            return (
              <Link
                key={row.id}
                href={{ pathname: '/messages/[conversationId]', params: { conversationId: row.id, workspace } }}
                asChild
              >
                <Pressable style={[styles.card, row.unread_count > 0 && styles.unreadCard]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleWrap}>
                      <Text style={styles.kind}>{row.conversation_kind.replaceAll('_', ' ')}</Text>
                      <Text style={styles.cardTitle}>{conversationTitle(row)}</Text>
                    </View>
                    {row.unread_count > 0 ? <Text style={styles.unreadBadge}>{row.unread_count}</Text> : null}
                  </View>
                  <Text style={styles.counterpart}>{row.counterpart_name}</Text>
                  {context ? <Text style={styles.context}>{context}</Text> : null}
                  <Text numberOfLines={2} style={styles.preview}>{row.last_message_body || 'Open conversation'}</Text>
                  <Text style={styles.openText}>{row.conversation_status === 'closed' ? 'View history →' : 'Open thread →'}</Text>
                </Pressable>
              </Link>
            );
          })}
        </ScrollView>
        <MobileNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 },
  content: { gap: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: '#77778a' },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '800', color: '#171721' },
  description: { fontSize: 14, lineHeight: 20, color: '#666678' },
  count: { minWidth: 38, textAlign: 'center', fontSize: 14, fontWeight: '800', color: '#fff', backgroundColor: '#30304a', paddingHorizontal: 9, paddingVertical: 8, borderRadius: 999 },
  workspaceRow: { flexDirection: 'row', gap: 8, padding: 5, borderRadius: 13, backgroundColor: '#ededf4' },
  workspaceButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  workspaceButtonActive: { backgroundColor: '#30304a' },
  workspaceText: { fontSize: 12, fontWeight: '800', color: '#555565' },
  workspaceTextActive: { color: '#fff' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ededf4' },
  refreshText: { fontSize: 12, fontWeight: '800', color: '#3f3f58' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 8, padding: 15, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: 'transparent' },
  unreadCard: { borderColor: '#b8b8d0' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, gap: 3 },
  kind: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#77778a' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#171721' },
  unreadBadge: { minWidth: 24, textAlign: 'center', fontSize: 10, fontWeight: '800', color: '#fff', backgroundColor: '#30304a', paddingHorizontal: 6, paddingVertical: 5, borderRadius: 999 },
  counterpart: { fontSize: 13, fontWeight: '800', color: '#444454' },
  context: { fontSize: 12, color: '#77778a' },
  preview: { fontSize: 13, lineHeight: 19, color: '#555565' },
  openText: { fontSize: 12, fontWeight: '800', color: '#30304a' },
  muted: { fontSize: 13, lineHeight: 18, color: '#77778a' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
