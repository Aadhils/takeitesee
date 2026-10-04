import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../components/BrandLogo';

import { MobileNav } from '../components/MobileNav';
import {
  fetchProviderServiceAvailability,
  formatProviderServiceAvailabilityMode,
  updateProviderServiceAvailability,
  type ProviderServiceAvailability,
  type ProviderServiceAvailabilityMode,
} from '../lib/provider-service-availability';
import { cardShadow, theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

type ScreenState =
  | { status: 'loading'; services: ProviderServiceAvailability[] }
  | { status: 'ready'; services: ProviderServiceAvailability[] }
  | { status: 'error'; services: ProviderServiceAvailability[]; message: string };

const modes: { value: ProviderServiceAvailabilityMode; label: string; detail: string }[] = [
  { value: 'always_available', label: 'Always available', detail: 'Customers can see available booking times even without weekly hours.' },
  { value: 'on_request', label: 'On request', detail: 'Keep booking flexible and confirm the time with the customer.' },
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
          <View style={styles.brandRow}><BrandLogo compact /></View>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>SERVICE AVAILABILITY</Text>
              <Text style={styles.title}>Booking mode</Text>
              <Text style={styles.description}>Choose how each service accepts bookings without changing your detailed schedule.</Text>
            </View>
            <Pressable accessibilityRole="button" disabled={state.status === 'loading' || Boolean(savingServiceId)} onPress={() => void load()} style={[styles.refreshButton, (state.status === 'loading' || Boolean(savingServiceId)) && styles.refreshDisabled]}><Text style={styles.refreshText}>Refresh</Text></Pressable>
          </View>

          <View style={styles.boundaryCard}>
            <Text style={styles.boundaryTitle}>Quick control only</Text>
            <Text style={styles.muted}>Existing timezone, weekly hours and blackout periods are preserved. For detailed schedule editing, use the web.</Text>
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
                  
                </View>
                <Text style={styles.modeBadge}>{formatProviderServiceAvailabilityMode(service.availability_mode)}</Text>
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
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
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
  safeArea: { flex: 1, backgroundColor: theme.colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 },
  refreshDisabled: { opacity: 0.5 },
  brandRow: { alignItems: 'center', paddingBottom: 6 },
  content: { gap: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: theme.colors.primary },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  refreshButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: theme.radii.md, backgroundColor: theme.colors.secondary },
  refreshText: { fontSize: 12, fontWeight: '900', color: theme.colors.primaryStrong },
  boundaryCard: { gap: 4, padding: 14, borderRadius: theme.radii.lg, backgroundColor: theme.colors.secondary },
  boundaryTitle: { fontSize: 13, fontWeight: '900', color: theme.colors.primaryStrong },
  successCard: { padding: 13, borderRadius: 12, backgroundColor: '#edf8ef' },
  successText: { fontSize: 13, fontWeight: '700', color: '#285c33' },
  errorCard: { padding: 13, borderRadius: 12, backgroundColor: '#fff0f0' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, ...cardShadow },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { fontSize: 17, fontWeight: '900', color: theme.colors.ink },
  modeBadge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '900', color: theme.colors.primaryStrong, backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: theme.radii.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  meta: { fontSize: 11, fontWeight: '700', color: theme.colors.primaryStrong, backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: theme.radii.sm },
  modeList: { gap: 8 },
  modeButton: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, paddingVertical: 10, borderRadius: theme.radii.lg, backgroundColor: theme.colors.secondary },
  modeSelected: { backgroundColor: theme.colors.primary },
  modeDisabled: { opacity: 0.48 },
  modeCopy: { flex: 1, minWidth: 0, gap: 2 },
  modeTitle: { fontSize: 13, fontWeight: '900', color: theme.colors.ink },
  modeDetail: { fontSize: 11, lineHeight: 16, color: theme.colors.inkMuted },
  modeSelectedText: { color: '#fff' },
  modeSelectedDetail: { color: '#F0EDFF' },
  modeMark: { fontSize: 18, fontWeight: '900', color: theme.colors.primary },
  muted: { fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
});
