import { Link, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createCustomerBooking,
  fetchServiceBookingAvailability,
  type BookingAvailability,
} from '../../lib/bookings';
import {
  fetchPublicProvider,
  findProviderService,
  formatPublicServicePrice,
  type PublicProviderProfile,
  type PublicProviderService,
  type PublicProviderType,
} from '../../lib/providers';
import { useAuth } from '../../providers/AuthProvider';

type ScreenState =
  | { status: 'loading' }
  | { status: 'ready'; provider: PublicProviderProfile; service: PublicProviderService; availability: BookingAvailability }
  | { status: 'error'; message: string };

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function providerTypeParam(value: string | undefined): PublicProviderType | null {
  return value === 'professional' || value === 'business' ? value : null;
}

function createIdempotencyKey() {
  return `mobile-booking:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
}

function supportedCurrency(value: string): 'INR' | 'USD' | null {
  return value === 'INR' || value === 'USD' ? value : null;
}

export default function BookServiceScreen() {
  const auth = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    serviceId?: string | string[];
    providerType?: string | string[];
    providerId?: string | string[];
  }>();
  const serviceId = firstParam(params.serviceId)?.trim() ?? '';
  const providerType = providerTypeParam(firstParam(params.providerType));
  const providerId = firstParam(params.providerId)?.trim() ?? '';
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const idempotencyKey = useRef('');
  if (!idempotencyKey.current) idempotencyKey.current = createIdempotencyKey();

  useEffect(() => {
    let active = true;
    if (auth.status !== 'signedIn') return () => { active = false; };
    if (!serviceId || !providerType || !providerId) {
      setState({ status: 'error', message: 'Booking context is incomplete.' });
      return () => { active = false; };
    }

    setState({ status: 'loading' });
    setActionError('');
    Promise.all([
      fetchPublicProvider(providerType, providerId),
      fetchServiceBookingAvailability(serviceId),
    ])
      .then(([providerPayload, availability]) => {
        if (!active) return;
        const provider = providerPayload.provider;
        const service = findProviderService(provider, serviceId);
        if (!service) {
          setState({ status: 'error', message: 'This service is no longer publicly available.' });
          return;
        }
        setState({ status: 'ready', provider, service, availability });
        const firstDay = availability.days.find((day) => day.slots.some((slot) => slot.available));
        setSelectedDate(firstDay?.date ?? '');
        setSelectedTime('');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to load booking availability.',
        });
      });

    return () => { active = false; };
  }, [auth.status, providerId, providerType, serviceId]);

  const selectedDay = useMemo(() => {
    if (state.status !== 'ready') return undefined;
    return state.availability.days.find((day) => day.date === selectedDate);
  }, [selectedDate, state]);

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}><ActivityIndicator /><Text style={styles.muted}>Checking your session…</Text></View>
      </SafeAreaView>
    );
  }
  if (auth.status === 'signedOut') return <Redirect href="/login" />;

  if (!serviceId || !providerType || !providerId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Booking context is incomplete.</Text>
          <Link href="/explore" style={styles.backLink}>Back to Explore</Link>
        </View>
      </SafeAreaView>
    );
  }

  const ready = state.status === 'ready' ? state : null;
  const serviceLocation = ready ? (ready.service.location || ready.provider.location || '').trim() : '';
  const currency = ready ? supportedCurrency(ready.service.currency) : null;
  const directlyBookable = Boolean(
    ready
      && ready.service.base_price != null
      && ready.service.duration_minutes
      && ready.service.duration_minutes > 0
      && serviceLocation
      && currency,
  );

  const submit = async () => {
    if (!ready || !directlyBookable || !currency || !selectedDate || !selectedTime || busy) return;
    setBusy(true);
    setActionError('');
    try {
      const payload = await createCustomerBooking({
        service_id: ready.service.id,
        provider_id: ready.provider.id,
        provider_type: ready.provider.provider_type,
        booking_date: selectedDate,
        time_label: selectedTime,
        timezone: ready.availability.timezone,
        duration_minutes: ready.availability.duration_minutes,
        location: serviceLocation,
        quoted_price: ready.service.base_price ?? 0,
        currency,
        idempotency_key: idempotencyKey.current,
        service_name: ready.service.name,
      });
      router.replace({ pathname: '/bookings/[bookingId]', params: { bookingId: payload.booking.id } });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Booking could not be created.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Link
          href={{ pathname: '/service/[serviceId]', params: { serviceId, providerType, providerId } }}
          style={styles.backLink}
        >
          ← Service detail
        </Link>

        {state.status === 'loading' ? (
          <View style={styles.inlineStatus}><ActivityIndicator /><Text style={styles.muted}>Loading live availability…</Text></View>
        ) : null}
        {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}

        {ready ? (
          <>
            <View style={styles.headerCard}>
              <Text style={styles.eyebrow}>DIRECT BOOKING</Text>
              <Text style={styles.title}>{ready.service.name}</Text>
              <Text style={styles.providerName}>{ready.provider.name}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>{formatPublicServicePrice(ready.service)}</Text>
                <Text style={styles.meta}>{ready.availability.duration_minutes} min</Text>
                {serviceLocation ? <Text style={styles.meta}>{serviceLocation}</Text> : null}
              </View>
            </View>

            {!directlyBookable ? (
              <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Direct booking unavailable</Text>
                <Text style={styles.muted}>
                  This service needs a configured price, duration, supported currency and location before direct booking. Use the service request flow instead.
                </Text>
                <Link href="/request-service" style={styles.requestLink}>Request a service</Link>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Choose a date</Text>
                  <Text style={styles.muted}>Only live server-generated availability can be selected.</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
                    {ready.availability.days.map((day) => {
                      const count = day.slots.filter((slot) => slot.available).length;
                      const selected = selectedDate === day.date;
                      return (
                        <Pressable
                          key={day.date}
                          disabled={!count}
                          onPress={() => { setSelectedDate(day.date); setSelectedTime(''); }}
                          style={[styles.dateChip, selected && styles.dateChipSelected, !count && styles.disabled]}
                        >
                          <Text style={[styles.dateLabel, selected && styles.selectedText]}>{day.label}</Text>
                          <Text style={[styles.dateCount, selected && styles.selectedText]}>{count ? `${count} times` : 'Unavailable'}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {selectedDay ? (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Choose a time</Text>
                    <View style={styles.slotGrid}>
                      {selectedDay.slots.map((slot) => {
                        const selected = selectedTime === slot.time;
                        return (
                          <Pressable
                            key={slot.time}
                            disabled={!slot.available}
                            onPress={() => setSelectedTime(slot.time)}
                            style={[styles.slotChip, selected && styles.slotSelected, !slot.available && styles.disabled]}
                          >
                            <Text style={[styles.slotText, selected && styles.selectedText]}>{slot.time}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Server-authoritative booking</Text>
                  <Text style={styles.muted}>
                    The server revalidates Customer identity, Provider ownership separation, service availability, conflicts, price, duration, currency and location before creating the booking. No payment is collected here.
                  </Text>
                </View>

                {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
                <Pressable
                  disabled={busy || !selectedDate || !selectedTime}
                  onPress={() => void submit()}
                  style={({ pressed }) => [styles.primaryButton, (pressed || busy || !selectedDate || !selectedTime) && styles.disabled]}
                >
                  <Text style={styles.primaryButtonText}>{busy ? 'Booking…' : 'Book selected time'}</Text>
                </Pressable>
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  content: { padding: 18, gap: 12, paddingBottom: 34 },
  backLink: { fontSize: 13, fontWeight: '800', color: '#30304a' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCard: { gap: 8, padding: 18, borderRadius: 18, backgroundColor: '#fff' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: '#77778a' },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: '#171721' },
  providerName: { fontSize: 14, fontWeight: '700', color: '#555565' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  meta: { fontSize: 11, color: '#44445d', backgroundColor: '#f0f0f5', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 },
  card: { gap: 12, padding: 17, borderRadius: 17, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#171721' },
  dateRow: { gap: 8, paddingVertical: 2 },
  dateChip: { width: 126, gap: 4, padding: 11, borderRadius: 12, backgroundColor: '#f0f0f6' },
  dateChipSelected: { backgroundColor: '#30304a' },
  dateLabel: { fontSize: 11, fontWeight: '800', color: '#444454' },
  dateCount: { fontSize: 9, color: '#77778a' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 9, backgroundColor: '#eeeeF4' },
  slotSelected: { backgroundColor: '#30304a' },
  slotText: { fontSize: 11, fontWeight: '700', color: '#444454' },
  selectedText: { color: '#fff' },
  disabled: { opacity: 0.4 },
  infoCard: { gap: 6, padding: 15, borderRadius: 14, backgroundColor: '#eeeeF5' },
  infoTitle: { fontSize: 13, fontWeight: '800', color: '#3d3d54' },
  requestLink: { marginTop: 6, fontSize: 13, fontWeight: '800', color: '#30304a' },
  primaryButton: { alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#30304a' },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  muted: { fontSize: 13, lineHeight: 19, color: '#77778a' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
});
