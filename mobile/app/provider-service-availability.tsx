import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileNav } from '../components/MobileNav';
import {
  fetchProviderServiceAvailability,
  formatProviderServiceAvailabilityMode,
  updateProviderServiceAvailability,
  type ProviderServiceAvailability,
  type ProviderServiceAvailabilityMode,
} from '../lib/provider-service-availability';
import { useAuth } from '../providers/AuthProvider';

type ScreenState =
  | { status: 'loading'; services: ProviderServiceAvailability[] }
  | { status: 'ready'; services: ProviderServiceAvailability[] }
  | { status: 'error'; services: ProviderServiceAvailability[]; message: string };

const modes: { value: ProviderServiceAvailabilityMode; label: string; detail: string }[] = [
  { value: 'always_available', label: 'Always available', detail: 'Customers can receive server-generated availability without weekly-hour gating.' },
  { value: 'on_request', label: 'On request', detail: 'Keep booking flexible and confirm timing through the normal booking journey.' },
  { value: 'scheduled', label: 'Scheduled', detail: 'Use your existing weekly booking hours. Weekly hours must already exist.' },
];

export default function ProviderServiceAvailabilityScreen() {
  const auth = useAuth();
  const [state, setState] = useState<ScreenState>({ status: 'loading', services: [] });
  const [savingServiceId, setSavingServiceId] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const isProvider = auth.status === 'signedIn'
    && (auth.identity.roles.includes('professional') || auth.identity.roles.includes('business_owner'));

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn' || !isProvider) return;
    setState((current) => ({ status: 'loading', services: current.services }));
    setActionError('');
    try {
      const payload = await fetchProviderServiceAvailability();
      setState({ status: 'ready', services: payload.services ?? [] });
    } catch (error) {
      setState({
        status: 'error',
        services: [],
        message: error instanceof Error ? error.message : 'Unable to load service availability.',
      });
    }
  }, [auth.status, isProvider]);

  useEffect(() => { void load(); }, [load]);

  if (auth.status === 'loading') {
    return <SafeAreaView style={styles.safeArea}><View style={styles.centered}><ActivityIndicator /><Text style={styles.muted}>Checking provider access…</Text></View></SafeAreaView>;
  }
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  if (!isProvider) return <Redirect href="/home" />;

  const updateMode = async (service: ProviderServiceAvailability, mode: ProviderServiceAvailabilityMode) => {
    if (savingServiceId || mode === service.availability_mode) return;
    if (mode === 'scheduled' && service.weekly_window_count === 0) {
      setActionError('Scheduled mode needs existing weekly hours. Configure the detailed schedule on web first.');
      return;
    }
    setSavingServiceId(service.id);
    setActionError('');
    setNotice('');
    try {
      const payload = await updateProviderServiceAvailability(service.id, mode);
      setState((current) => ({
        status: 'ready',
        services: current.services.map((item) => item.id === service.id ? payload.service : item),
      }));
      setNotice(`${service.name}: ${formatProviderServiceAvailabilityMode(mode)} saved.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Availability could not be updated.');
    } finally {
      setSavingServiceId('');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>SERVICE AVAILABILITY</Text>
              <Text style={styles.title}>Booking mode</Text>
              <Text style={styles.description}>Quickly switch each owned service between flexible and existing scheduled booking modes.</Text>
            </View>
            <Pressable onPress={() => void load()} style={styles.refreshButton}><Text style={styles.refreshText}>Refresh</Text></Pressable>
          </View>

          <View style={styles.boundaryCard}>
            <Text style={styles.boundaryTitle}>Quick control only</Text>
            <Text style={styles.muted}>This screen changes only the service availability mode. Existing timezone, weekly hours and blackout periods are preserved. Detailed schedule editing remains on web.</Text>
          </View>

          {notice ? <View style={styles.successCard}><Text style={styles.successText}>{notice}</Text></View> : null}
          {actionError ? <View style={styles.errorCard}><Text style={styles.errorText}>{actionError}</Text></View> : null}
          {state.status === 'loading' ? <View style={styles.inlineStatus}><ActivityIndicator /><Text style={styles.muted}>Loading your services…</Text></View> : null}
          {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}

          {state.status === 'ready' && state.services.length === 0 ? (
            <View style={styles.card}><Text style={styles.cardTitle}>No services yet</Text><Text style={styles.muted}>Create a Provider service on web first. It will appear here for quick availability control.</Text></View>
          ) : null}

          {state.services.map((service) => {
            const saving = savingServiceId === service.id;
            return (
              <View key={service.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{service.name}</Text>
                    <Text style={styles.muted}>{service.category || 'Service'} · {service.status}</Text>
                  </View>
                  <Text style={styles.modeBadge}>{formatProviderServiceAvailabilityMode(service.availability_mode)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{service.timezone}</Text>
                  <Text style={styles.meta}>{service.weekly_window_count} weekly window{service.weekly_window_count === 1 ? '' : 's'}</Text>
                  {service.location ? <Text style={styles.meta}>{service.location}</Text> : null}
                </View>
                <View style={styles.modeList}>
                  {modes.map((mode) => {
                    const selected = service.availability_mode === mode.value;
                    const scheduleBlocked = mode.value === 'scheduled' && service.weekly_window_count === 0;
                    const disabled = saving || scheduleBlocked;
                    return (
                      <Pressable
                        key={mode.value}
                        disabled={disabled}
                        onPress={() => void updateMode(service, mode.value)}
                        style={[styles.modeButton, selected && styles.modeSelected, disabled && styles.modeDisabled]}
                      >
                        <View style={styles.modeCopy}>
                          <Text style={[styles.modeTitle, selected && styles.modeSelectedText]}>{mode.label}</Text>
                          <Text style={[styles.modeDetail, selected && styles.modeSelectedDetail]}>{scheduleBlocked ? 'Add weekly hours on web before choosing Scheduled.' : mode.detail}</Text>
                        </View>
                        <Text style={[styles.modeMark, selected && styles.modeSelectedText]}>{saving && !selected ? '…' : selected ? '✓' : '→'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
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
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#171721' },
  description: { fontSize: 14, lineHeight: 20, color: '#666678' },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ededf4' },
  refreshText: { fontSize: 12, fontWeight: '800', color: '#3f3f58' },
  boundaryCard: { gap: 4, padding: 14, borderRadius: 14, backgroundColor: '#f0f0f6' },
  boundaryTitle: { fontSize: 13, fontWeight: '800', color: '#3d3d54' },
  successCard: { padding: 13, borderRadius: 12, backgroundColor: '#edf8ef' },
  successText: { fontSize: 13, fontWeight: '700', color: '#285c33' },
  errorCard: { padding: 13, borderRadius: 12, backgroundColor: '#fff0f0' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 12, padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#171721' },
  modeBadge: { fontSize: 10, fontWeight: '800', color: '#4b4b65', backgroundColor: '#efeff5', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  meta: { fontSize: 11, fontWeight: '700', color: '#555565', backgroundColor: '#f4f4f8', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  modeList: { gap: 8 },
  modeButton: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, backgroundColor: '#f5f5f9' },
  modeSelected: { backgroundColor: '#30304a' },
  modeDisabled: { opacity: 0.48 },
  modeCopy: { flex: 1, gap: 2 },
  modeTitle: { fontSize: 13, fontWeight: '800', color: '#30304a' },
  modeDetail: { fontSize: 11, lineHeight: 16, color: '#6d6d7d' },
  modeSelectedText: { color: '#fff' },
  modeSelectedDetail: { color: '#dedee9' },
  modeMark: { fontSize: 18, fontWeight: '800', color: '#30304a' },
  muted: { fontSize: 13, lineHeight: 18, color: '#77778a' },
});
