import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../../components/BrandLogo';

import {
  fetchProviderBooking,
  formatBookingMoney,
  formatBookingStatus,
  formatBookingTime,
  reportProviderCustomerNoShow,
  transitionProviderBooking,
  type ProviderBooking,
  type ProviderBookingAction,
} from '../../lib/bookings';
import { theme } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';

type DetailState =
  | { status: 'loading'; booking: ProviderBooking | null }
  | { status: 'ready'; booking: ProviderBooking }
  | { status: 'error'; booking: null; message: string };

export default function ProviderBookingDetailScreen() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  const [state, setState] = useState<DetailState>({ status: 'loading', booking: null });
  const [declineReason, setDeclineReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState<ProviderBookingAction | null>(null);
  const [noShowNote, setNoShowNote] = useState('');
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceConfirmOpen, setAttendanceConfirmOpen] = useState(false);

  const isProvider = auth.status === 'signedIn'
    && (auth.identity.roles.includes('professional') || auth.identity.roles.includes('business_owner'));

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn' || !isProvider || !bookingId) return;
    setState({ status: 'loading', booking: null });
    try {
      const payload = await fetchProviderBooking(bookingId);
      setState({ status: 'ready', booking: payload.booking });
    } catch (error) {
      setState({
        status: 'error',
        booking: null,
        message: error instanceof Error ? error.message : 'Unable to load provider booking.',
      });
    }
  }, [auth.status, bookingId, isProvider]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitAction = async (action: ProviderBookingAction) => {
    if (!bookingId || busyAction || attendanceBusy) return;
    setActionError('');
    setBusyAction(action);
    try {
      const payload = await transitionProviderBooking(
        bookingId,
        action,
        action === 'decline' ? declineReason : undefined,
      );
      setState({ status: 'ready', booking: payload.booking });
      setDeclineReason('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update booking.');
    } finally {
      setBusyAction(null);
    }
  };

  const submitCustomerNoShow = async () => {
    if (!bookingId || attendanceBusy || busyAction) return;
    setAttendanceError('');
    setAttendanceBusy(true);
    try {
      await reportProviderCustomerNoShow(bookingId, noShowNote);
      const payload = await fetchProviderBooking(bookingId);
      setState({ status: 'ready', booking: payload.booking });
      setNoShowNote('');
      setAttendanceConfirmOpen(false);
    } catch (error) {
      setAttendanceError(error instanceof Error ? error.message : 'Unable to record attendance.');
    } finally {
      setAttendanceBusy(false);
    }
  };

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

  if (!bookingId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Booking ID is missing.</Text>
          <Link href="/provider-bookings" style={styles.backLink}>Back to provider bookings</Link>
        </View>
      </SafeAreaView>
    );
  }

  const booking = state.status === 'ready' ? state.booking : null;
  const canRespond = booking ? ['pending', 'rescheduled'].includes(booking.status) : false;
  const canOfferCustomerNoShow = booking
    ? booking.status === 'confirmed' && booking.attendance_outcome === 'pending'
    : false;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}><BrandLogo compact /></View>
        <View style={styles.topRow}>
          <Link href="/provider-bookings" style={styles.backLink}>← Provider bookings</Link>
          <Pressable accessibilityRole="button" disabled={state.status === 'loading' || !!busyAction || attendanceBusy} onPress={() => void load()} style={[styles.refreshButton, (state.status === 'loading' || !!busyAction || attendanceBusy) && styles.disabled]}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.inlineStatus}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading provider booking…</Text>
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
                
              </View>
              <Text style={styles.statusBadge}>{formatBookingStatus(booking.status)}</Text>
              <Text style={styles.description}>{booking.provider_name} · {booking.provider_type}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Service details</Text>
              <DetailRow label="Date" value={booking.booking_date} />
              <DetailRow label="Start time" value={formatBookingTime(booking.start_time)} />
              <DetailRow label="Timezone" value={booking.timezone} />
              <DetailRow label="Duration" value={`${booking.duration_minutes} min`} />
              <DetailRow label="Location" value={booking.location} />
              <DetailRow label="Quoted service price" value={formatBookingMoney(booking.quoted_price, booking.currency)} />
              {booking.customer_notes ? <DetailRow label="Customer note" value={booking.customer_notes} /> : null}
            </View>

            {canRespond ? (
              <View style={styles.actionCard}>
                <Text style={styles.eyebrow}>{booking.status === 'rescheduled' ? 'Reschedule request' : 'Booking request'}</Text>
                <Text style={styles.sectionTitle}>
                  {booking.status === 'rescheduled' ? 'Confirm the customer’s new time' : 'Respond to this booking'}
                </Text>
                <Text style={styles.muted}>
                  Accept confirms this booking. Decline requires a reason and cancels the request. The server remains authoritative for ownership and status rules.
                </Text>

                <Pressable
                  accessibilityRole="button"
                  disabled={busyAction !== null || attendanceBusy}
                  onPress={() => void submitAction('accept')}
                  style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed, (busyAction !== null || attendanceBusy) && styles.disabled]}
                >
                  <Text style={styles.acceptButtonText}>
                    {busyAction === 'accept'
                      ? 'Accepting…'
                      : booking.status === 'rescheduled' ? 'Accept new time' : 'Accept booking'}
                  </Text>
                </Pressable>

                <View style={styles.declineBox}>
                  <Text style={styles.fieldLabel}>Decline reason</Text>
                  <TextInput
                    editable={busyAction === null && !attendanceBusy}
                    maxLength={500}
                    multiline
                    accessibilityLabel="Decline reason"
                    onChangeText={setDeclineReason}
                    placeholder="Tell the customer why you cannot take this booking"
                    style={styles.input}
                    value={declineReason}
                  />
                  <Text style={styles.counter}>{declineReason.trim().length}/500</Text>
                  <Pressable
                  accessibilityRole="button"
                    disabled={busyAction !== null || attendanceBusy || declineReason.trim().length < 3}
                    onPress={() => void submitAction('decline')}
                    style={({ pressed }) => [
                      styles.declineButton,
                      pressed && styles.pressed,
                      (busyAction !== null || attendanceBusy || declineReason.trim().length < 3) && styles.disabled,
                    ]}
                  >
                    <Text style={styles.declineButtonText}>{busyAction === 'decline' ? 'Declining…' : 'Decline booking'}</Text>
                  </Pressable>
                </View>

                {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
              </View>
            ) : null}

            {canOfferCustomerNoShow ? (
              <View style={styles.attendanceCard}>
                <Text style={styles.eyebrow}>Attendance</Text>
                <Text style={styles.sectionTitle}>Customer did not attend?</Text>
                <Text style={styles.muted}>
                  Use this only when the customer did not attend the confirmed booking. The server verifies Provider ownership, the no-show grace period and whether an attendance outcome is already recorded.
                </Text>

                <View style={styles.declineBox}>
                  <Text style={styles.fieldLabel}>Optional attendance note</Text>
                  <TextInput
                    editable={!attendanceBusy && busyAction === null}
                    maxLength={1000}
                    multiline
                    accessibilityLabel="Optional attendance note"
                    onChangeText={setNoShowNote}
                    placeholder="Add factual details that may help if the customer disputes the report"
                    style={styles.input}
                    value={noShowNote}
                  />
                  <Text style={styles.counter}>{noShowNote.trim().length}/1000</Text>
                </View>

                {!attendanceConfirmOpen ? (
                  <Pressable
                  accessibilityRole="button"
                    disabled={attendanceBusy || busyAction !== null}
                    onPress={() => {
                      setAttendanceError('');
                      setAttendanceConfirmOpen(true);
                    }}
                    style={({ pressed }) => [
                      styles.reportButton,
                      pressed && styles.pressed,
                      (attendanceBusy || busyAction !== null) && styles.disabled,
                    ]}
                  >
                    <Text style={styles.reportButtonText}>Report customer no-show</Text>
                  </Pressable>
                ) : (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmText}>
                      Confirm only if the customer was absent. This records the attendance outcome through the existing server workflow and notifies the customer; it does not complete the booking or collect payment.
                    </Text>
                    <View style={styles.confirmActions}>
                      <Pressable
                  accessibilityRole="button"
                        disabled={attendanceBusy || busyAction !== null}
                        onPress={() => void submitCustomerNoShow()}
                        style={({ pressed }) => [
                          styles.reportButton,
                          styles.confirmPrimary,
                          pressed && styles.pressed,
                          (attendanceBusy || busyAction !== null) && styles.disabled,
                        ]}
                      >
                        <Text style={styles.reportButtonText}>{attendanceBusy ? 'Reporting…' : 'Confirm no-show'}</Text>
                      </Pressable>
                      <Pressable
                  accessibilityRole="button"
                        disabled={attendanceBusy}
                        onPress={() => setAttendanceConfirmOpen(false)}
                        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, attendanceBusy && styles.disabled]}
                      >
                        <Text style={styles.secondaryButtonText}>Go back</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {attendanceError ? <Text style={styles.errorText}>{attendanceError}</Text> : null}
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Journey status</Text>
              <DetailRow label="Booking" value={formatBookingStatus(booking.status)} />
              <DetailRow label="Attendance" value={formatBookingStatus(booking.attendance_outcome)} />
              {booking.closeout_state ? <DetailRow label="Closeout" value={formatBookingStatus(booking.closeout_state)} /> : null}
              {booking.closed_at ? <DetailRow label="Closed at" value={String(booking.closed_at)} /> : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Status history</Text>
              {booking.history.length === 0 ? (
                <Text style={styles.muted}>No status history entries were returned for this booking.</Text>
              ) : booking.history.map((entry, index) => (
                <View key={`${entry.created_at}-${index}`} style={styles.historyRow}>
                  <View style={styles.historyDot} />
                  <View style={styles.historyCopy}>
                    <Text style={styles.historyTitle}>
                      {entry.from_status ? `${formatBookingStatus(entry.from_status)} → ` : ''}{formatBookingStatus(entry.to_status)}
                    </Text>
                    <Text style={styles.muted}>{entry.created_at}</Text>
                    {entry.reason ? <Text style={styles.historyReason}>{entry.reason}</Text> : null}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.readOnlyCard}>
              <Text style={styles.readOnlyTitle}>Booking actions</Text>
              <Text style={styles.muted}>
                Accept, decline or report a Customer no-show when those actions are available for this booking.
              </Text>
            </View>
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
  safeArea: { flex: 1, backgroundColor: theme.colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  brandRow: { alignItems: 'center' },
  content: { padding: 18, gap: 12, paddingBottom: 28 },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  backLink: { flexShrink: 1, fontSize: 13, fontWeight: '800', color: theme.colors.primaryStrong },
  refreshButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.colors.secondary },
  refreshText: { fontSize: 12, fontWeight: '800', color: theme.colors.primaryStrong },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { borderWidth: 1, borderColor: theme.colors.border, gap: 12, padding: 17, borderRadius: 17, backgroundColor: '#fff' },
  actionCard: { gap: 12, padding: 17, borderRadius: 17, backgroundColor: '#fff7e8' },
  attendanceCard: { gap: 12, padding: 17, borderRadius: 17, backgroundColor: '#eef7f2' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, minWidth: 0, gap: 4 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: theme.colors.inkMuted, textTransform: 'uppercase' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  statusBadge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: theme.colors.primaryStrong, backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.ink },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  detailLabel: { flex: 1, fontSize: 12, color: theme.colors.inkMuted },
  detailValue: { flex: 1.3, fontSize: 13, fontWeight: '700', textAlign: 'right', color: theme.colors.ink },
  acceptButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, backgroundColor: theme.colors.primary },
  acceptButtonText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  declineBox: { gap: 8, paddingTop: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.ink },
  input: { minHeight: 86, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: '#fff', color: theme.colors.ink, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: theme.colors.inkMuted },
  declineButton: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#9a3d3d', backgroundColor: '#fff' },
  declineButtonText: { fontSize: 13, fontWeight: '800', color: '#8b3535' },
  reportButton: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: '#7a3b2e' },
  reportButtonText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  confirmBox: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#fff' },
  confirmText: { fontSize: 12, lineHeight: 18, color: theme.colors.inkMuted },
  confirmActions: { gap: 8 },
  confirmPrimary: { flex: 1 },
  secondaryButton: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#c8c8d3', backgroundColor: '#fff' },
  secondaryButtonText: { fontSize: 13, fontWeight: '800', color: theme.colors.inkMuted },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  historyDot: { width: 9, height: 9, marginTop: 5, borderRadius: 999, backgroundColor: theme.colors.primary },
  historyCopy: { flex: 1, gap: 2 },
  historyTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.ink },
  historyReason: { fontSize: 12, lineHeight: 18, color: theme.colors.inkMuted },
  readOnlyCard: { gap: 4, padding: 14, borderRadius: 14, backgroundColor: theme.colors.secondary },
  readOnlyTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.ink },
  muted: { fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
