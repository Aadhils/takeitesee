import { Link, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
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

import { BrandLogo } from '../../components/BrandLogo';

import {
  cancelCustomerBooking,
  fetchCustomerBooking,
  fetchCustomerBookingAvailability,
  formatBookingStatus,
  isCurrentBookingSlot,
  rescheduleCustomerBooking,
  type BookingAvailability,
  type CustomerBooking,
} from '../../lib/bookings';
import { theme } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';

const cancellationReasons = ['Plans changed', 'Booked by mistake', 'Timing no longer works', 'Found another provider'];
const rescheduleReasons = ['Timing no longer works', 'Work or personal commitment', 'Travel or delay', 'Need a different day'];

type ScreenState =
  | { status: 'loading'; booking: null; availability: null }
  | { status: 'ready'; booking: CustomerBooking; availability: BookingAvailability | null }
  | { status: 'error'; booking: null; availability: null; message: string };

export default function CustomerBookingActionsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  const [state, setState] = useState<ScreenState>({ status: 'loading', booking: null, availability: null });
  const [availabilityError, setAvailabilityError] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [busyAction, setBusyAction] = useState<'cancel' | 'reschedule' | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn' || !bookingId) return;
    setState({ status: 'loading', booking: null, availability: null });
    setAvailabilityError('');
    try {
      const bookingPayload = await fetchCustomerBooking(bookingId);
      const booking = bookingPayload.booking;
      let availability: BookingAvailability | null = null;
      if (isManageable(booking)) {
        try {
          availability = await fetchCustomerBookingAvailability(bookingId);
        } catch (error) {
          setAvailabilityError(error instanceof Error ? error.message : 'Unable to load reschedule availability.');
        }
      }
      setState({ status: 'ready', booking, availability });
      const firstDay = availability?.days.find((day) => day.slots.some((slot) => slot.available && !isCurrentBookingSlot(booking, day.date, slot.time)));
      setSelectedDate(firstDay?.date ?? '');
      setSelectedTime('');
    } catch (error) {
      setState({
        status: 'error',
        booking: null,
        availability: null,
        message: error instanceof Error ? error.message : 'Unable to load booking actions.',
      });
    }
  }, [auth.status, bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedDay = useMemo(() => {
    if (state.status !== 'ready') return undefined;
    return state.availability?.days.find((day) => day.date === selectedDate);
  }, [selectedDate, state]);

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}><ActivityIndicator /><Text style={styles.muted}>Checking your session…</Text></View>
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
  const manageable = booking ? isManageable(booking) : false;

  const returnToBooking = () => {
    router.replace({ pathname: '/bookings/[bookingId]', params: { bookingId } });
  };

  const submitCancel = async () => {
    if (!booking || !manageable || busyAction) return;
    setBusyAction('cancel');
    setActionError('');
    try {
      await cancelCustomerBooking(booking.id, cancelReason);
      returnToBooking();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Booking could not be cancelled.');
    } finally {
      setBusyAction(null);
    }
  };

  const submitReschedule = async () => {
    if (!booking || !manageable || busyAction || !selectedDate || !selectedTime) return;
    setBusyAction('reschedule');
    setActionError('');
    try {
      await rescheduleCustomerBooking(booking.id, selectedDate, selectedTime, rescheduleReason);
      returnToBooking();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Booking could not be rescheduled.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}><BrandLogo compact /></View>
        <View style={styles.topRow}>
          <Link href={{ pathname: '/bookings/[bookingId]', params: { bookingId } }} style={styles.backLink}>← Booking detail</Link>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: state.status === 'loading' || busyAction !== null }} disabled={state.status === 'loading' || busyAction !== null} onPress={() => void load()} style={[styles.refreshButton, (state.status === 'loading' || busyAction !== null) && styles.buttonMuted]}><Text style={styles.refreshText}>Refresh</Text></Pressable>
        </View>

        {state.status === 'loading' ? <View style={styles.inlineStatus}><ActivityIndicator /><Text style={styles.muted}>Loading booking actions…</Text></View> : null}
        {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}

        {booking ? (
          <>
            <View style={styles.headerCard}>
              <Text style={styles.eyebrow}>{booking.booking_reference}</Text>
              <Text style={styles.title}>{booking.service_name}</Text>
              <Text style={styles.description}>{booking.booking_date} · {booking.start_time.slice(0, 5)}</Text>
              <Text style={styles.statusBadge}>{formatBookingStatus(booking.status)}</Text>
            </View>

            {!manageable ? (
              <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Actions unavailable</Text>
                <Text style={styles.muted}>This booking can no longer be cancelled or rescheduled. Server booking rules remain authoritative.</Text>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Cancel booking</Text>
                  <Text style={styles.muted}>Choose a common reason or type your own. The server will validate whether cancellation is still allowed.</Text>
                  <ReasonChips disabled={busyAction !== null} options={cancellationReasons} value={cancelReason} onChange={setCancelReason} />
                  <TextInput
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    accessibilityLabel="Cancellation reason"
                    editable={busyAction === null}
                    placeholder="Cancellation reason"
                    maxLength={500}
                    multiline
                    style={styles.input}
                  />
                  <Text style={styles.counter}>{cancelReason.trim().length}/500</Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busyAction !== null || cancelReason.trim().length < 3}
                    onPress={() => void submitCancel()}
                    style={({ pressed }) => [styles.dangerButton, (pressed || busyAction !== null || cancelReason.trim().length < 3) && styles.buttonMuted]}
                  >
                    <Text style={styles.buttonText}>{busyAction === 'cancel' ? 'Cancelling…' : 'Cancel booking'}</Text>
                  </Pressable>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Reschedule</Text>
                  <Text style={styles.muted}>Only live server availability is selectable. Your current slot and unavailable slots stay disabled.</Text>
                  {availabilityError ? <Text style={styles.errorText}>{availabilityError}</Text> : null}

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
                    {state.availability?.days.map((day) => {
                      const count = day.slots.filter((slot) => slot.available && !isCurrentBookingSlot(booking, day.date, slot.time)).length;
                      const selected = selectedDate === day.date;
                      return (
                        <Pressable
                          key={day.date}
                          accessibilityRole="button"
                          accessibilityState={{ selected, disabled: !count || busyAction !== null }}
                          disabled={!count || busyAction !== null}
                          onPress={() => { setSelectedDate(day.date); setSelectedTime(''); }}
                          style={[styles.dateChip, selected && styles.dateChipSelected, !count && styles.dateChipDisabled]}
                        >
                          <Text style={[styles.dateLabel, selected && styles.dateLabelSelected]}>{day.label}</Text>
                          <Text style={[styles.dateCount, selected && styles.dateLabelSelected]}>{count ? `${count} times` : 'No alternative'}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {selectedDay ? (
                    <View style={styles.slotGrid}>
                      {selectedDay.slots.map((slot) => {
                        const current = isCurrentBookingSlot(booking, selectedDay.date, slot.time);
                        const disabled = !slot.available || current || busyAction !== null;
                        const selected = selectedTime === slot.time;
                        return (
                          <Pressable
                            key={slot.time}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled }}
                            disabled={disabled}
                            onPress={() => setSelectedTime(slot.time)}
                            style={[styles.slotChip, selected && styles.slotChipSelected, disabled && styles.slotChipDisabled]}
                          >
                            <Text style={[styles.slotText, selected && styles.slotTextSelected]}>{slot.time}{current ? ' · Current' : ''}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}

                  <ReasonChips options={rescheduleReasons} value={rescheduleReason} onChange={setRescheduleReason} />
                  <TextInput
                    value={rescheduleReason}
                    onChangeText={setRescheduleReason}
                    accessibilityLabel="Reschedule reason"
                    editable={busyAction === null}
                    placeholder="Why do you need a new time?"
                    maxLength={500}
                    multiline
                    style={styles.input}
                  />
                  <Text style={styles.counter}>{rescheduleReason.trim().length}/500</Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busyAction !== null || !selectedDate || !selectedTime || rescheduleReason.trim().length < 3}
                    onPress={() => void submitReschedule()}
                    style={({ pressed }) => [styles.primaryButton, (pressed || busyAction !== null || !selectedDate || !selectedTime || rescheduleReason.trim().length < 3) && styles.buttonMuted]}
                  >
                    <Text style={styles.buttonText}>{busyAction === 'reschedule' ? 'Requesting…' : 'Request reschedule'}</Text>
                  </Pressable>
                </View>
              </>
            )}

            {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Before you continue</Text>
              <Text style={styles.muted}>Available actions depend on the booking status. We recheck availability and booking details before saving changes.</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function isManageable(booking: CustomerBooking) {
  return ['pending', 'confirmed', 'rescheduled'].includes(booking.status)
    && !['customer_no_show', 'provider_no_show'].includes(booking.attendance_outcome ?? '');
}

function ReasonChips({ options, value, onChange, disabled }: { options: string[]; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <View style={styles.reasonWrap}>
      {options.map((option) => {
        const selected = value === option;
        return (
          <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => onChange(option)} style={[styles.reasonChip, selected && styles.reasonChipSelected]}>
            <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  content: { padding: 18, gap: 12, paddingBottom: 34 },
  brandRow: { alignItems: 'center' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.colors.secondary, color: theme.colors.primaryStrong, fontSize: 12, fontWeight: '800' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  backLink: { fontSize: 13, fontWeight: '800', color: theme.colors.primary },
  refreshButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.colors.secondary },
  refreshText: { fontSize: 12, fontWeight: '800', color: theme.colors.inkMuted },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCard: { gap: 5, padding: 17, borderRadius: 17, backgroundColor: theme.colors.white, borderWidth: 1, borderColor: theme.colors.border },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: theme.colors.inkMuted },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: theme.colors.ink },
  description: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  card: { gap: 12, padding: 17, borderRadius: 17, backgroundColor: theme.colors.white, borderWidth: 1, borderColor: theme.colors.border },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.ink },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  reasonChip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.colors.secondary },
  reasonChipSelected: { backgroundColor: theme.colors.primary },
  reasonText: { fontSize: 11, fontWeight: '700', color: theme.colors.inkMuted },
  reasonTextSelected: { color: theme.colors.white },
  input: { minHeight: 78, padding: 12, borderRadius: 12, backgroundColor: theme.colors.secondary, borderWidth: 1, borderColor: theme.colors.border, textAlignVertical: 'top', color: theme.colors.ink },
  counter: { alignSelf: 'flex-end', fontSize: 10, color: theme.colors.inkMuted },
  dateRow: { gap: 8, paddingVertical: 2 },
  dateChip: { width: 126, gap: 4, padding: 11, borderRadius: 12, backgroundColor: theme.colors.secondary },
  dateChipSelected: { backgroundColor: theme.colors.primary },
  dateChipDisabled: { opacity: 0.4 },
  dateLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.inkMuted },
  dateCount: { fontSize: 9, color: theme.colors.inkMuted },
  dateLabelSelected: { color: theme.colors.white },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, backgroundColor: theme.colors.secondary },
  slotChipSelected: { backgroundColor: theme.colors.primary },
  slotChipDisabled: { opacity: 0.35 },
  slotText: { fontSize: 11, fontWeight: '700', color: theme.colors.inkMuted },
  slotTextSelected: { color: theme.colors.white },
  primaryButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: theme.colors.primary },
  dangerButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: theme.colors.danger },
  buttonMuted: { opacity: 0.45 },
  buttonText: { fontSize: 13, fontWeight: '800', color: theme.colors.white },
  infoCard: { gap: 5, padding: 14, borderRadius: 14, backgroundColor: theme.colors.secondary },
  infoTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.inkMuted },
  muted: { fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
  errorText: { fontSize: 13, lineHeight: 19, color: theme.colors.danger },
});
