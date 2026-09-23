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
        <View style={styles.topRow}>
          <Link href={{ pathname: '/bookings/[bookingId]', params: { bookingId } }} style={styles.backLink}>← Booking detail</Link>
          <Pressable onPress={() => void load()} style={styles.refreshButton}><Text style={styles.refreshText}>Refresh</Text></Pressable>
        </View>

        {state.status === 'loading' ? <View style={styles.inlineStatus}><ActivityIndicator /><Text style={styles.muted}>Loading booking actions…</Text></View> : null}
        {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}

        {booking ? (
          <>
            <View style={styles.headerCard}>
              <Text style={styles.eyebrow}>{booking.booking_reference}</Text>
              <Text style={styles.title}>{booking.service_name}</Text>
              <Text style={styles.description}>{booking.booking_date} · {booking.start_time.slice(0, 5)} · {formatBookingStatus(booking.status)}</Text>
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
                  <ReasonChips options={cancellationReasons} value={cancelReason} onChange={setCancelReason} />
                  <TextInput
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    placeholder="Cancellation reason"
                    maxLength={500}
                    multiline
                    style={styles.input}
                  />
                  <Text style={styles.counter}>{cancelReason.trim().length}/500</Text>
                  <Pressable
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
                          disabled={!count}
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
                        const disabled = !slot.available || current;
                        const selected = selectedTime === slot.time;
                        return (
                          <Pressable
                            key={slot.time}
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
                    placeholder="Why do you need a new time?"
                    maxLength={500}
                    multiline
                    style={styles.input}
                  />
                  <Text style={styles.counter}>{rescheduleReason.trim().length}/500</Text>
                  <Pressable
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
              <Text style={styles.infoTitle}>Server-authoritative actions</Text>
              <Text style={styles.muted}>The app only submits your selected action. Booking state transitions, conflicts and eligibility are enforced by the existing server APIs.</Text>
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

function ReasonChips({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.reasonWrap}>
      {options.map((option) => {
        const selected = value === option;
        return (
          <Pressable key={option} onPress={() => onChange(option)} style={[styles.reasonChip, selected && styles.reasonChipSelected]}>
            <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  content: { padding: 18, gap: 12, paddingBottom: 34 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  backLink: { fontSize: 13, fontWeight: '800', color: '#30304a' },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ededf4' },
  refreshText: { fontSize: 12, fontWeight: '800', color: '#3f3f58' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCard: { gap: 5, padding: 17, borderRadius: 17, backgroundColor: '#fff' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: '#77778a' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#171721' },
  description: { fontSize: 13, lineHeight: 19, color: '#666678' },
  card: { gap: 12, padding: 17, borderRadius: 17, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#171721' },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  reasonChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#f0f0f6' },
  reasonChipSelected: { backgroundColor: '#30304a' },
  reasonText: { fontSize: 11, fontWeight: '700', color: '#555565' },
  reasonTextSelected: { color: '#fff' },
  input: { minHeight: 78, padding: 12, borderRadius: 12, backgroundColor: '#f7f7fb', borderWidth: 1, borderColor: '#e1e1e9', textAlignVertical: 'top', color: '#242433' },
  counter: { alignSelf: 'flex-end', fontSize: 10, color: '#888899' },
  dateRow: { gap: 8, paddingVertical: 2 },
  dateChip: { width: 126, gap: 4, padding: 11, borderRadius: 12, backgroundColor: '#f0f0f6' },
  dateChipSelected: { backgroundColor: '#30304a' },
  dateChipDisabled: { opacity: 0.4 },
  dateLabel: { fontSize: 11, fontWeight: '800', color: '#444454' },
  dateCount: { fontSize: 9, color: '#77778a' },
  dateLabelSelected: { color: '#fff' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, backgroundColor: '#eeeeF4' },
  slotChipSelected: { backgroundColor: '#30304a' },
  slotChipDisabled: { opacity: 0.35 },
  slotText: { fontSize: 11, fontWeight: '700', color: '#444454' },
  slotTextSelected: { color: '#fff' },
  primaryButton: { alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: '#30304a' },
  dangerButton: { alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: '#7f2f2f' },
  buttonMuted: { opacity: 0.45 },
  buttonText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  infoCard: { gap: 5, padding: 14, borderRadius: 14, backgroundColor: '#f0f0f6' },
  infoTitle: { fontSize: 13, fontWeight: '800', color: '#3d3d54' },
  muted: { fontSize: 13, lineHeight: 18, color: '#77778a' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
