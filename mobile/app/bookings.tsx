import { Link, Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../components/BrandLogo';

import { MobileNav } from '../components/MobileNav';
import {
  fetchCustomerBookings,
  formatBookingStatus,
  formatBookingTime,
  type CustomerBooking,
} from '../lib/bookings';
import { cardShadow, theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

type BookingState =
  | { status: 'loading'; bookings: CustomerBooking[] }
  | { status: 'ready'; bookings: CustomerBooking[] }
  | { status: 'error'; bookings: CustomerBooking[]; message: string };

export default function CustomerBookingsScreen() {
  const auth = useAuth();
  const [state, setState] = useState<BookingState>({ status: 'loading', bookings: [] });

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn') return;
    setState((current) => ({ status: 'loading', bookings: current.bookings }));
    try {
      const payload = await fetchCustomerBookings();
      setState({ status: 'ready', bookings: payload.bookings ?? [] });
    } catch (error) {
      setState({
        status: 'error',
        bookings: [],
        message: error instanceof Error ? error.message : 'Unable to load bookings.',
      });
    }
  }, [auth.status]);

  useEffect(() => {
    void load();
  }, [load]);

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.muted}>Checking your session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (auth.status === 'signedOut') return <Redirect href="/login" />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <BrandLogo compact />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>MY BOOKINGS</Text>
              <Text style={styles.title}>Service journey</Text>
              <Text style={styles.description}>
                Review your marketplace service bookings and current status.
              </Text>
            </View>
            <Pressable onPress={() => void load()} style={styles.refreshButton}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          {state.status === 'loading' ? (
            <View style={styles.inlineStatus}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading bookings…</Text>
            </View>
          ) : null}
          {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}

          {state.status === 'ready' && state.bookings.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No bookings yet</Text>
              <Text style={styles.muted}>When a service booking is created, it will appear here.</Text>
              <Link href="/explore" style={styles.primaryLink}>Explore services</Link>
            </View>
          ) : null}

          {state.bookings.map((booking) => (
            <Link
              key={booking.id}
              href={{ pathname: '/bookings/[bookingId]', params: { bookingId: booking.id } }}
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
                <Text style={styles.detail}>
                  {booking.provider_name || (booking.provider.provider_type === 'business' ? 'Business provider' : 'Professional provider')}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{booking.booking_date}</Text>
                  <Text style={styles.meta}>{formatBookingTime(booking.start_time)}</Text>
                  <Text style={styles.meta}>{booking.location}</Text>
                </View>
                {booking.attendance_outcome && booking.attendance_outcome !== 'pending' ? (
                  <Text style={styles.attendance}>Attendance: {formatBookingStatus(booking.attendance_outcome)}</Text>
                ) : null}
                <Text style={styles.openText}>View booking →</Text>
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
  safeArea: { flex: 1, backgroundColor: theme.colors.canvas },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 },
  content: { gap: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: theme.colors.primary },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: theme.radii.md, backgroundColor: theme.colors.secondary },
  refreshText: { fontSize: 12, fontWeight: '900', color: theme.colors.primaryStrong },
  readOnlyCard: { gap: 4, padding: 14, borderRadius: 14, backgroundColor: '#f0f0f6' },
  readOnlyTitle: { fontSize: 13, fontWeight: '800', color: '#3d3d54' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 10, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, ...cardShadow },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, gap: 3 },
  reference: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7, color: theme.colors.primary },
  cardTitle: { fontSize: 17, fontWeight: '900', color: theme.colors.ink },
  statusBadge: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: theme.colors.primaryStrong, backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: theme.radii.sm },
  detail: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  meta: { fontSize: 11, fontWeight: '700', color: theme.colors.primaryStrong, backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: theme.radii.sm },
  attendance: { fontSize: 12, fontWeight: '700', color: '#285c33' },
  openText: { fontSize: 12, fontWeight: '900', color: theme.colors.primary },
  primaryLink: { alignSelf: 'flex-start', marginTop: 2, paddingVertical: 9, paddingHorizontal: 12, borderRadius: theme.radii.md, backgroundColor: theme.colors.primary, color: theme.colors.white, fontWeight: '900' },
  muted: { fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
