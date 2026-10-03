import { Link, Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import {
  fetchProviderBookings,
  formatBookingStatus,
  formatBookingTime,
  type ProviderBooking,
} from '../lib/bookings';
import { cardShadow, theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

type BookingState =
  | { status: 'loading'; bookings: ProviderBooking[] }
  | { status: 'ready'; bookings: ProviderBooking[] }
  | { status: 'error'; bookings: ProviderBooking[]; message: string };

export default function ProviderBookingsScreen() {
  const auth = useAuth();
  const [state, setState] = useState<BookingState>({ status: 'loading', bookings: [] });

  const isProvider = auth.status === 'signedIn'
    && (auth.identity.roles.includes('professional') || auth.identity.roles.includes('business_owner'));

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn' || !isProvider) return;
    setState((current) => ({ status: 'loading', bookings: current.bookings }));
    try {
      const payload = await fetchProviderBookings();
      setState({ status: 'ready', bookings: payload.bookings ?? [] });
    } catch (error) {
      setState({
        status: 'error',
        bookings: [],
        message: error instanceof Error ? error.message : 'Unable to load provider bookings.',
      });
    }
  }, [auth.status, isProvider]);

  useEffect(() => {
    void load();
  }, [load]);

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.muted}>Checking provider access…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  if (!isProvider) return <Redirect href="/home" />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.brandRow}><BrandLogo compact /></View>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>PROVIDER BOOKINGS</Text>
              <Text style={styles.title}>Service schedule</Text>
              <Text style={styles.description}>
                Review your assigned service bookings and current status.
              </Text>
            </View>
            <Pressable accessibilityRole="button" disabled={state.status === 'loading'} onPress={() => void load()} style={[styles.refreshButton, state.status === 'loading' && styles.disabled]}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          <Link href="/provider-live-status" asChild>
            <Pressable accessibilityRole="button" style={styles.liveStatusEntry}>
              <View style={styles.liveStatusCopy}>
                <Text style={styles.liveStatusTitle}>Live work status</Text>
                <Text style={styles.liveStatusText}>Set Available, Busy, Offline or Paused for the time that suits you.</Text>
              </View>
              <Text style={styles.liveStatusArrow}>→</Text>
            </Pressable>
          </Link>

          <Link href="/provider-service-availability" asChild>
            <Pressable accessibilityRole="button" style={styles.liveStatusEntry}>
              <View style={styles.liveStatusCopy}>
                <Text style={styles.liveStatusTitle}>Service booking mode</Text>
                <Text style={styles.liveStatusText}>Switch each service between Always available, On request and existing Scheduled hours.</Text>
              </View>
              <Text style={styles.liveStatusArrow}>→</Text>
            </Pressable>
          </Link>

          <View style={styles.readOnlyCard}>
            <Text style={styles.readOnlyTitle}>Booking actions</Text>
            <Text style={styles.muted}>
              Open a booking to see the actions available for its current status.
            </Text>
          </View>

          {state.status === 'loading' ? (
            <View style={styles.inlineStatus}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading provider bookings…</Text>
            </View>
          ) : null}
          {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}

          {state.status === 'ready' && state.bookings.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No provider bookings yet</Text>
              <Text style={styles.muted}>Service bookings will appear here when they are assigned to you.</Text>
            </View>
          ) : null}

          {state.bookings.map((booking) => (
            <Link
              key={booking.id}
              href={{ pathname: '/provider-bookings/[bookingId]', params: { bookingId: booking.id } }}
              asChild
            >
              <Pressable accessibilityRole="button" accessibilityLabel={`View provider booking for ${booking.service_name}`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.reference}>{booking.booking_reference}</Text>
                    <Text style={styles.cardTitle}>{booking.service_name}</Text>
                  </View>
                  
                </View>
                <Text style={styles.statusBadge}>{formatBookingStatus(booking.status)}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{booking.booking_date}</Text>
                  <Text style={styles.meta}>{formatBookingTime(booking.start_time)}</Text>
                  <Text style={styles.meta}>{booking.location}</Text>
                </View>
                {booking.attendance_outcome !== 'pending' ? (
                  <Text style={styles.attendance}>Attendance: {formatBookingStatus(booking.attendance_outcome)}</Text>
                ) : null}
                <View style={styles.openAction}><Text style={styles.openText}>View booking →</Text></View>
              </Pressable>
            </Link>
          ))}
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
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  openAction: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: theme.colors.primary },
  content: { gap: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: theme.colors.primary },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  refreshButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.colors.secondary },
  refreshText: { fontSize: 12, fontWeight: '800', color: theme.colors.primaryStrong },
  liveStatusEntry: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: theme.radii.lg, backgroundColor: theme.colors.primary, ...cardShadow },
  liveStatusCopy: { flex: 1, minWidth: 0, gap: 3 },
  liveStatusTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  liveStatusText: { fontSize: 12, lineHeight: 17, color: '#dedee9' },
  liveStatusArrow: { fontSize: 22, fontWeight: '800', color: '#fff' },
  readOnlyCard: { gap: 4, padding: 14, borderRadius: theme.radii.lg, backgroundColor: theme.colors.secondary },
  readOnlyTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.ink },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 10, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, ...cardShadow },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, minWidth: 0, gap: 3 },
  reference: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, color: theme.colors.inkMuted },
  cardTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.ink },
  statusBadge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: theme.colors.primaryStrong, backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  meta: { fontSize: 11, fontWeight: '700', color: theme.colors.inkMuted, backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  attendance: { fontSize: 12, fontWeight: '700', color: '#285c33' },
  openText: { fontSize: 13, fontWeight: '800', color: theme.colors.white },
  muted: { fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
