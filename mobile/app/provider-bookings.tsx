import { Link, Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileNav } from '../components/MobileNav';
import {
  fetchProviderBookings,
  formatBookingStatus,
  formatBookingTime,
  type ProviderBooking,
} from '../lib/bookings';
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
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>PROVIDER BOOKINGS</Text>
              <Text style={styles.title}>Service schedule</Text>
              <Text style={styles.description}>
                Review bookings assigned to your server-verified Provider identity.
              </Text>
            </View>
            <Pressable onPress={() => void load()} style={styles.refreshButton}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          <View style={styles.readOnlyCard}>
            <Text style={styles.readOnlyTitle}>Read-only in this native slice</Text>
            <Text style={styles.muted}>
              Accept, decline, completion, attendance and closeout actions are intentionally not available here yet.
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
              <Text style={styles.muted}>Accepted service bookings will appear here when assigned to this Provider identity.</Text>
            </View>
          ) : null}

          {state.bookings.map((booking) => (
            <Link
              key={booking.id}
              href={{ pathname: '/provider-bookings/[bookingId]', params: { bookingId: booking.id } }}
              asChild
            >
              <Pressable style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.reference}>{booking.booking_reference}</Text>
                    <Text style={styles.cardTitle}>{booking.service_name}</Text>
                  </View>
                  <Text style={styles.statusBadge}>{formatBookingStatus(booking.status)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{booking.booking_date}</Text>
                  <Text style={styles.meta}>{formatBookingTime(booking.start_time)}</Text>
                  <Text style={styles.meta}>{booking.location}</Text>
                </View>
                {booking.attendance_outcome !== 'pending' ? (
                  <Text style={styles.attendance}>Attendance: {formatBookingStatus(booking.attendance_outcome)}</Text>
                ) : null}
                <Text style={styles.openText}>View provider booking →</Text>
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
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 },
  content: { gap: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: '#77778a' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#171721' },
  description: { fontSize: 14, lineHeight: 20, color: '#666678' },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ededf4' },
  refreshText: { fontSize: 12, fontWeight: '800', color: '#3f3f58' },
  readOnlyCard: { gap: 4, padding: 14, borderRadius: 14, backgroundColor: '#f0f0f6' },
  readOnlyTitle: { fontSize: 13, fontWeight: '800', color: '#3d3d54' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, gap: 3 },
  reference: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, color: '#77778a' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#171721' },
  statusBadge: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#4b4b65', backgroundColor: '#efeff5', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  meta: { fontSize: 11, fontWeight: '700', color: '#555565', backgroundColor: '#f4f4f8', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  attendance: { fontSize: 12, fontWeight: '700', color: '#285c33' },
  openText: { fontSize: 12, fontWeight: '800', color: '#30304a' },
  muted: { fontSize: 13, lineHeight: 18, color: '#77778a' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
