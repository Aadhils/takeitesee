import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NativeNotification,
} from '../lib/notifications';
import { cardShadow, theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

type NotificationState =
  | { status: 'loading'; notifications: NativeNotification[] }
  | { status: 'ready'; notifications: NativeNotification[] }
  | { status: 'error'; notifications: NativeNotification[]; message: string };

const UUID = '[0-9a-fA-F-]{36}';

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function NotificationsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [state, setState] = useState<NotificationState>({ status: 'loading', notifications: [] });
  const [busyId, setBusyId] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState('');

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
    if (busyId || markingAll || state.status === 'loading') return;
    setActionError('');
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
    } catch {
      setActionError('Could not open this update. Please try again.');
    } finally {
      setBusyId('');
    }
  };

  const markAll = async () => {
    if (markingAll || busyId || state.status !== 'ready' || unreadCount === 0) return;
    setActionError('');
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setState((current) => ({
        ...current,
        notifications: current.notifications.map((item) => ({ ...item, read_at: item.read_at || now })),
      }));
    } catch {
      setActionError('Could not mark notifications as read. Please try again.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.brandRow}><BrandLogo compact /></View>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>NOTIFICATIONS</Text>
              <Text style={styles.title}>My updates</Text>
              <Text style={styles.description}>Booking, proposal and messaging updates from your marketplace activity.</Text>
            </View>
            <Text style={styles.count}>{unreadCount}</Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" disabled={state.status === 'loading' || !!busyId || markingAll} onPress={() => { setActionError(''); void load(); }} style={[styles.secondaryButton, (state.status === 'loading' || !!busyId || markingAll) && styles.disabled]}>
              <Text style={styles.secondaryText}>Refresh</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={markingAll || !!busyId || state.status !== 'ready' || unreadCount === 0} onPress={() => void markAll()} style={[styles.primaryButton, (markingAll || !!busyId || state.status !== 'ready' || unreadCount === 0) && styles.disabled]}>
              {markingAll ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Mark all read</Text>}
            </Pressable>
          </View>

          {state.status === 'loading' ? <View style={styles.inlineStatus}><ActivityIndicator /><Text style={styles.muted}>Loading notifications…</Text></View> : null}
          {state.status === 'error' ? <Text accessibilityRole="alert" style={styles.errorText}>{state.message}</Text> : null}
          {actionError ? <Text accessibilityRole="alert" style={styles.errorText}>{actionError}</Text> : null}
          {state.status === 'ready' && state.notifications.length === 0 ? (
            <View style={styles.card}><Text style={styles.cardTitle}>No notifications yet</Text><Text style={styles.muted}>New marketplace updates will appear here.</Text></View>
          ) : null}

          {state.notifications.map((item) => {
            const unread = !item.read_at;
            return (
              <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ busy: busyId === item.id }} disabled={!!busyId || markingAll || state.status === 'loading'} onPress={() => void openNotification(item)} style={[styles.card, unread && styles.unreadCard]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.eventType}>{item.event_type.replaceAll('_', ' ')}</Text>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  {unread ? <Text style={styles.unreadBadge}>NEW</Text> : null}
                </View>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.timestamp}>{formatNotificationTime(item.created_at)}</Text>
                <Text style={styles.openText}>{busyId === item.id ? 'Opening…' : item.target_path || item.conversation_id || item.booking_id ? 'Open update →' : unread ? 'Mark as read' : 'Read'}</Text>
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
  safeArea: { flex: 1, backgroundColor: theme.colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 },
  brandRow: { alignItems: 'center', paddingBottom: 6 },
  content: { gap: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: theme.colors.primary },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '900', color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  count: { minWidth: 38, textAlign: 'center', fontSize: 14, fontWeight: '900', color: theme.colors.white, backgroundColor: theme.colors.primary, paddingHorizontal: 9, paddingVertical: 8, borderRadius: theme.radii.pill },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: theme.radii.md, backgroundColor: theme.colors.primary },
  primaryText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: theme.radii.md, backgroundColor: theme.colors.secondary },
  secondaryText: { fontSize: 12, fontWeight: '900', color: theme.colors.primaryStrong },
  disabled: { opacity: 0.45 },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 8, padding: 15, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, ...cardShadow },
  unreadCard: { borderColor: theme.colors.accent, backgroundColor: '#FBFAFF' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, minWidth: 0, gap: 3 },
  eventType: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: theme.colors.primary },
  cardTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.ink },
  unreadBadge: { fontSize: 9, fontWeight: '800', color: '#285c33', backgroundColor: '#edf8ef', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  body: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  timestamp: { fontSize: 11, color: theme.colors.inkMuted },
  openText: { fontSize: 12, fontWeight: '900', color: theme.colors.primary },
  muted: { fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
