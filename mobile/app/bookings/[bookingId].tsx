import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  confirmCustomerServiceCompletion,
  fetchCustomerBooking,
  formatBookingMoney,
  formatBookingStatus,
  formatBookingTime,
  type CustomerBooking,
} from '../../lib/bookings';
import { useAuth } from '../../providers/AuthProvider';

type DetailState =
  | { status: 'loading'; booking: CustomerBooking | null }
  | { status: 'ready'; booking: CustomerBooking }
  | { status: 'error'; booking: null; message: string };

export default function CustomerBookingDetailScreen() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  const [state, setState] = useState<DetailState>({ status: 'loading', booking: null });
  const [completionConfirmOpen, setCompletionConfirmOpen] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [completionError, setCompletionError] = useState('');

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn' || !bookingId) return;
    setState({ status: 'loading', booking: null });
    try {
      const payload = await fetchCustomerBooking(bookingId);
      setState({ status: 'ready', booking: payload.booking });
    } catch (error) {
      setState({
        status: 'error',
        booking: null,
        message: error instanceof Error ? error.message : 'Unable to load booking.',
      });
    }
  }, [auth.status, bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitCompletionAcknowledgement = async () => {
    if (!bookingId || completionBusy) return;
    setCompletionError('');
    setCompletionBusy(true);
    try {
      await confirmCustomerServiceCompletion(bookingId);
      const refreshed = await fetchCustomerBooking(bookingId);
      setState({ status: 'ready', booking: refreshed.booking });
      setCompletionConfirmOpen(false);
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : 'Unable to confirm service completion.');
    } finally {
      setCompletionBusy(false);
    }
  };

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

  if (!bookingId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Booking ID is missing.</Text>
          <Link href="/bookings" style={styles.backLink}>Back to bookings</Link>
        </View>
      </SafeAreaView>
    );
  }

  const booking = state.status === 'ready' ? state.booking : null;
  const providerLabel = booking?.provider_name
    || (booking?.provider.provider_type === 'business' ? 'Business provider' : 'Professional provider');
  const canManage = booking
    ? ['pending', 'confirmed', 'rescheduled'].includes(booking.status)
      && !['customer_no_show', 'provider_no_show'].includes(booking.attendance_outcome ?? '')
    : false;
  const canConfirmCompletion = booking
    ? booking.status === 'completed'
      && booking.attendance_outcome === 'service_completed'
      && booking.closeout_state === 'awaiting_customer'
    : false;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Link href="/bookings" style={styles.backLink}>← My bookings</Link>
          <Pressable onPress={() => void load()} style={styles.refreshButton}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.inlineStatus}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading booking…</Text>
          </View>
        ) : null}
        {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}

        {booking ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.eyebrow}>{booking.booking_reference}</Text>
                  <Text style={styles.title}>{booking.service_name}</Text>
                </View>
                <Text style={styles.statusBadge}>{formatBookingStatus(booking.status)}</Text>
              </View>
              <Text style={styles.description}>
                {providerLabel} · {booking.provider.provider_type === 'business' ? 'Business' : 'Professional'}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Service details</Text>
              <DetailRow label="Date" value={booking.booking_date} />
              <DetailRow label="Start time" value={formatBookingTime(booking.start_time)} />
              <DetailRow label="Timezone" value={booking.timezone} />
              <DetailRow label="Duration" value={`${booking.duration_minutes} min`} />
              <DetailRow label="Location" value={booking.location} />
              <DetailRow label="Quoted service price" value={formatBookingMoney(booking.quoted_price, booking.currency)} />
              {booking.customer_notes ? <DetailRow label="Your note" value={booking.customer_notes} /> : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Journey status</Text>
              <DetailRow label="Booking" value={formatBookingStatus(booking.status)} />
              <DetailRow label="Attendance" value={formatBookingStatus(booking.attendance_outcome || 'pending')} />
              {booking.closeout_state ? <DetailRow label="Closeout" value={formatBookingStatus(booking.closeout_state)} /> : null}
              {booking.closed_at ? <DetailRow label="Closed at" value={String(booking.closed_at)} /> : null}
              <View style={styles.readOnlyCard}>
                <Text style={styles.readOnlyTitle}>Server-authoritative booking journey</Text>
                <Text style={styles.muted}>
                  Cancel, reschedule and completion acknowledgement use existing server APIs. Provider no-show/support and payment actions remain outside this native slice.
                </Text>
              </View>
            </View>

            {canManage ? (
              <Link
                href={{ pathname: '/booking-actions/[bookingId]', params: { bookingId: booking.id } }}
                style={styles.actionLink}
              >
                Manage booking
              </Link>
            ) : null}

            {canConfirmCompletion ? (
              <View style={styles.completionCard}>
                <Text style={styles.eyebrow}>Completion acknowledgement</Text>
                <Text style={styles.sectionTitle}>Was the service completed?</Text>
                <Text style={styles.muted}>
                  The Provider has already completed this booking. Confirm only if the service was delivered. The server verifies booking ownership and completion state; this action does not collect payment or complete the booking from the Provider side.
                </Text>

                {!completionConfirmOpen ? (
                  <Pressable
                    disabled={completionBusy}
                    onPress={() => {
                      setCompletionError('');
                      setCompletionConfirmOpen(true);
                    }}
                    style={({ pressed }) => [styles.completionButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.completionButtonText}>Confirm service completed</Text>
                  </Pressable>
                ) : (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmTitle}>Confirm completion?</Text>
                    <Text style={styles.muted}>
                      This acknowledges that you received the completed service. If you have a problem, do not confirm here.
                    </Text>
                    <View style={styles.confirmActions}>
                      <Pressable
                        disabled={completionBusy}
                        onPress={() => setCompletionConfirmOpen(false)}
                        style={({ pressed }) => [styles.cancelConfirmButton, pressed && styles.pressed, completionBusy && styles.disabled]}
                      >
                        <Text style={styles.cancelConfirmText}>Not now</Text>
                      </Pressable>
                      <Pressable
                        disabled={completionBusy}
                        onPress={() => void submitCompletionAcknowledgement()}
                        style={({ pressed }) => [styles.confirmCompletionButton, pressed && styles.pressed, completionBusy && styles.disabled]}
                      >
                        <Text style={styles.confirmCompletionText}>{completionBusy ? 'Confirming…' : 'Yes, confirm'}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {completionError ? <Text style={styles.errorText}>{completionError}</Text> : null}
              </View>
            ) : null}

            {booking.status === 'completed' ? (
              <Link
                href={{ pathname: '/reviews/[bookingId]', params: { bookingId: booking.id } }}
                style={styles.reviewLink}
              >
                Leave or view review
              </Link>
            ) : null}

            <Link
              href={{
                pathname: '/providers/[providerType]/[providerId]',
                params: {
                  providerType: booking.provider.provider_type,
                  providerId: booking.provider.provider_id,
                },
              }}
              style={styles.providerLink}
            >
              View provider profile
            </Link>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  content: { padding: 18, gap: 12, paddingBottom: 28 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  backLink: { fontSize: 13, fontWeight: '800', color: '#30304a' },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ededf4' },
  refreshText: { fontSize: 12, fontWeight: '800', color: '#3f3f58' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 12, padding: 17, borderRadius: 17, backgroundColor: '#fff' },
  completionCard: { gap: 12, padding: 17, borderRadius: 17, backgroundColor: '#eef8f1' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, gap: 4 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: '#77778a' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#171721' },
  description: { fontSize: 14, lineHeight: 20, color: '#555565' },
  statusBadge: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#4b4b65', backgroundColor: '#efeff5', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#171721' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  detailLabel: { flex: 1, fontSize: 12, color: '#77778a' },
  detailValue: { flex: 1.3, fontSize: 13, fontWeight: '700', textAlign: 'right', color: '#333342' },
  readOnlyCard: { gap: 4, padding: 13, borderRadius: 12, backgroundColor: '#f0f0f6' },
  readOnlyTitle: { fontSize: 13, fontWeight: '800', color: '#3d3d54' },
  actionLink: { textAlign: 'center', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#5a4378', color: '#fff', fontWeight: '800' },
  completionButton: { alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#1f6b45' },
  completionButtonText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  confirmBox: { gap: 10, padding: 13, borderRadius: 12, backgroundColor: '#fff' },
  confirmTitle: { fontSize: 14, fontWeight: '800', color: '#253e30' },
  confirmActions: { flexDirection: 'row', gap: 9 },
  cancelConfirmButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#ededf4' },
  cancelConfirmText: { fontSize: 13, fontWeight: '800', color: '#4b4b65' },
  confirmCompletionButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#1f6b45' },
  confirmCompletionText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  reviewLink: { textAlign: 'center', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#171721', color: '#fff', fontWeight: '800' },
  providerLink: { textAlign: 'center', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#30304a', color: '#fff', fontWeight: '800' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
  muted: { fontSize: 13, lineHeight: 18, color: '#77778a' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
