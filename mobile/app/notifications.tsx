import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileNav } from '../components/MobileNav';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NativeNotification,
} from '../lib/notifications';
import { useAuth } from '../providers/AuthProvider';

type NotificationState =
  | { status: 'loading'; notifications: NativeNotification[] }
  | { status: 'ready'; notifications: NativeNotification[] }
  | { status: 'error'; notifications: NativeNotification[]; message: string };

const UUID = '[0-9a-fA-F-]{36}';

export default function NotificationsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [state, setState] = useState<NotificationState>({ status: 'loading', notifications: [] });
  const [busyId, setBusyId] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn') return;
    setState((current) => ({ status: 'loading', notifications: current.notifications }));
    try {
      const payload = await fetchNotifications();
      setState({ status: 'ready', notifications: payload.notifications ?? [] });
    } catch (error) {
      setState({
        status: 'error',
        notifications: [],
        message: error instanceof Error ? error.message : 'Unable to load notifications.',
      });
    }
  }, [auth.status]);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(
    () => state.notifications.reduce((sum, item) => sum + (item.read_at ? 0 : 1), 0),
    [state.notifications],
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

  const openNativeTarget = (item: NativeNotification) => {
    const path = item.target_path || '';
    if (item.conversation_id) {
      const workspace = path.startsWith('/provider/messages') ? 'provider' : 'customer';
      router.push({
        pathname: '/messages/[conversationId]',
        params: { conversationId: item.conversation_id, workspace },
      });
      return;
    }
    if (item.booking_id) {
      if (path.startsWith('/provider/bookings')) {
        router.push({ pathname: '/provider-bookings/[bookingId]', params: { bookingId: item.booking_id } });
      } else {
        router.push({ pathname: '/bookings/[bookingId]', params: { bookingId: item.booking_id } });
      }
      return;
    }
    const requirementMatch = path.match(new RegExp(`^/requirements/(${UUID})`));
    if (requirementMatch?.[1]) {
      router.push({ pathname: '/requirements/[requirementId]', params: { requirementId: requirementMatch[1] } });
    }
  };

  const openNotification = async (item: NativeNotification) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      if (!item.read_at) await markNotificationRead(item.id);
      setState((current) => ({
        ...current,
        notifications: current.notifications.map((row) => row.id === item.id
          ? { ...row, read_at: row.read_at || new Date().toISOString() }
          : row),
      }));
      openNativeTarget(item);
    } finally {
      setBusyId('');
    }
  };

  const markAll = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setState((current) => ({
        ...current,
        notifications: current.notifications.map((item) => ({ ...item, read_at: item.read_at || now })),
      }));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>NOTIFICATIONS</Text>
              <Text style={styles.title}>Updates that need attention</Text>
              <Text style={styles.description}>Booking, proposal and messaging updates from your server-owned marketplace account.</Text>
            </View>
            <Text style={styles.count}>{unreadCount}</Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable onPress={() => void load()} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Refresh</Text>
            </Pressable>
            <Pressable disabled={markingAll || unreadCount === 0} onPress={() => void markAll()} style={[styles.primaryButton, (markingAll || unreadCount === 0) && styles.disabled]}>
              {markingAll ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Mark all read</Text>}
            </Pressable>
          </View>

          {state.status === 'loading' ? <View style={styles.inlineStatus}><ActivityIndicator /><Text style={styles.muted}>Loading notifications…</Text></View> : null}
          {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}
          {state.status === 'ready' && state.notifications.length === 0 ? (
            <View style={styles.card}><Text style={styles.cardTitle}>No notifications yet</Text><Text style={styles.muted}>New marketplace updates will appear here.</Text></View>
          ) : null}

          {state.notifications.map((item) => {
            const unread = !item.read_at;
            return (
              <Pressable key={item.id} disabled={busyId === item.id} onPress={() => void openNotification(item)} style={[styles.card, unread && styles.unreadCard]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.eventType}>{item.event_type.replaceAll('_', ' ')}</Text>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  {unread ? <Text style={styles.unreadBadge}>NEW</Text> : null}
                </View>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.timestamp}>{item.created_at}</Text>
                <Text style={styles.openText}>{item.target_path || item.conversation_id || item.booking_id ? 'Open update →' : unread ? 'Mark as read' : 'Read'}</Text>
              </Pressable>
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
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  primaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 10, backgroundColor: '#30304a' },
  primaryText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  secondaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 10, backgroundColor: '#ededf4' },
  secondaryText: { fontSize: 12, fontWeight: '800', color: '#3f3f58' },
  disabled: { opacity: 0.45 },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 8, padding: 15, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: 'transparent' },
  unreadCard: { borderColor: '#b8b8d0' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, gap: 3 },
  eventType: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#77778a' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#171721' },
  unreadBadge: { fontSize: 9, fontWeight: '800', color: '#285c33', backgroundColor: '#edf8ef', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  body: { fontSize: 13, lineHeight: 19, color: '#555565' },
  timestamp: { fontSize: 11, color: '#888899' },
  openText: { fontSize: 12, fontWeight: '800', color: '#30304a' },
  muted: { fontSize: 13, lineHeight: 18, color: '#77778a' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
