import { Link, Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileNav } from '../components/MobileNav';
import {
  effectiveProviderWorkMode,
  fetchProviderLiveAvailability,
  updateProviderLiveAvailability,
  type ProviderLiveAvailability,
  type ProviderLiveDurationMinutes,
  type ProviderWorkMode,
} from '../lib/provider-live-availability';
import { useAuth } from '../providers/AuthProvider';

type State =
  | { status: 'loading'; availability: ProviderLiveAvailability | null }
  | { status: 'ready'; availability: ProviderLiveAvailability }
  | { status: 'error'; availability: ProviderLiveAvailability | null; message: string };

const modes: Array<{ value: ProviderWorkMode; label: string; help: string }> = [
  { value: 'available', label: 'Available', help: 'Show that you can take work now for a short period.' },
  { value: 'busy', label: 'Busy', help: 'Show that you are working now but not immediately available.' },
  { value: 'offline', label: 'Offline', help: 'Hide live availability until you change it again.' },
  { value: 'paused', label: 'Paused', help: 'Temporarily pause live work matching without changing service schedules.' },
];

const durations: ProviderLiveDurationMinutes[] = [15, 30, 60];

export default function ProviderLiveStatusScreen() {
  const auth = useAuth();
  const [state, setState] = useState<State>({ status: 'loading', availability: null });
  const [duration, setDuration] = useState<ProviderLiveDurationMinutes>(30);
  const [saving, setSaving] = useState<ProviderWorkMode | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [clockTick, setClockTick] = useState(0);

  const isProvider = auth.status === 'signedIn'
    && (auth.identity.roles.includes('professional') || auth.identity.roles.includes('business_owner'));

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn' || !isProvider) return;
    setState((current) => ({ status: 'loading', availability: current.availability }));
    setActionError('');
    try {
      const payload = await fetchProviderLiveAvailability();
      setState({ status: 'ready', availability: payload.availability });
    } catch (error) {
      setState({
        status: 'error',
        availability: null,
        message: error instanceof Error ? error.message : 'Unable to load live work status.',
      });
    }
  }, [auth.status, isProvider]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setClockTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const availability = state.availability;
  const currentMode = useMemo(() => effectiveProviderWorkMode(availability), [availability, clockTick]);
  const expiryText = useMemo(() => {
    if (!availability?.mode_expires_at || !['available', 'busy'].includes(currentMode)) return '';
    const expiry = new Date(availability.mode_expires_at);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) return '';
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(expiry);
  }, [availability?.mode_expires_at, currentMode, clockTick]);

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}><ActivityIndicator /><Text style={styles.muted}>Checking provider access…</Text></View>
      </SafeAreaView>
    );
  }
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  if (!isProvider) return <Redirect href="/home" />;

  const updateMode = async (mode: ProviderWorkMode) => {
    if (saving) return;
    setSaving(mode);
    setNotice('');
    setActionError('');
    try {
      const payload = await updateProviderLiveAvailability(mode, duration);
      setState({ status: 'ready', availability: payload.availability });
      setNotice(`Live work status updated to ${mode}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Live work status could not be updated.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>PROVIDER LIVE STATUS</Text>
              <Text style={styles.title}>Are you available now?</Text>
              <Text style={styles.description}>
                This is a short-lived marketplace signal. It does not change per-service booking schedules, booking states, or shop hours.
              </Text>
            </View>
            <Pressable onPress={() => void load()} style={styles.refreshButton}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          <Link href="/provider-bookings" style={styles.backLink}>← Provider bookings</Link>

          <View style={styles.statusCard}>
            <Text style={styles.eyebrow}>CURRENT EFFECTIVE STATUS</Text>
            <Text style={styles.statusTitle}>{currentMode.replaceAll('_', ' ')}</Text>
            {expiryText ? <Text style={styles.muted}>Until {expiryText}</Text> : null}
            {state.status === 'loading' ? <View style={styles.inline}><ActivityIndicator /><Text style={styles.muted}>Refreshing…</Text></View> : null}
            {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Live duration</Text>
            <Text style={styles.muted}>Available and Busy automatically expire. Choose how long the live signal should remain active.</Text>
            <View style={styles.choiceRow}>
              {durations.map((value) => {
                const selected = duration === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setDuration(value)}
                    disabled={Boolean(saving)}
                    style={[styles.durationChip, selected && styles.durationChipSelected]}
                  >
                    <Text style={[styles.durationText, selected && styles.durationTextSelected]}>{value} min</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Choose status</Text>
            {modes.map((mode) => {
              const selected = currentMode === mode.value;
              const busy = saving === mode.value;
              return (
                <Pressable
                  key={mode.value}
                  disabled={Boolean(saving) || state.status === 'loading'}
                  onPress={() => void updateMode(mode.value)}
                  style={[styles.modeButton, selected && styles.modeButtonSelected, Boolean(saving) && styles.buttonMuted]}
                >
                  <View style={styles.modeCopy}>
                    <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>{busy ? 'Updating…' : mode.label}</Text>
                    <Text style={[styles.modeHelp, selected && styles.modeHelpSelected]}>{mode.help}</Text>
                  </View>
                  <Text style={[styles.modeMark, selected && styles.modeLabelSelected]}>{selected ? '✓' : '→'}</Text>
                </Pressable>
              );
            })}
          </View>

          {notice ? <View style={styles.successCard}><Text style={styles.successText}>{notice}</Text></View> : null}
          {actionError ? <View style={styles.errorCard}><Text style={styles.errorText}>{actionError}</Text></View> : null}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Server-authoritative live status</Text>
            <Text style={styles.muted}>
              Provider identity, ownership, expiry limits and stored state are enforced by the existing server API. Expired Available or Busy safely displays as Offline.
            </Text>
          </View>
        </ScrollView>
        <MobileNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 },
  content: { gap: 12, paddingBottom: 10 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: '#77778a' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#171721' },
  description: { fontSize: 14, lineHeight: 20, color: '#666678' },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ededf4' },
  refreshText: { fontSize: 12, fontWeight: '800', color: '#3f3f58' },
  backLink: { fontSize: 13, fontWeight: '800', color: '#30304a' },
  statusCard: { gap: 5, padding: 17, borderRadius: 17, backgroundColor: '#fff' },
  statusTitle: { fontSize: 24, fontWeight: '800', textTransform: 'capitalize', color: '#171721' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { gap: 12, padding: 17, borderRadius: 17, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#171721' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: { minWidth: 82, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: '#efeff5' },
  durationChipSelected: { backgroundColor: '#30304a' },
  durationText: { fontSize: 12, fontWeight: '800', color: '#555565' },
  durationTextSelected: { color: '#fff' },
  modeButton: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#f2f2f7' },
  modeButtonSelected: { backgroundColor: '#30304a' },
  modeCopy: { flex: 1, gap: 3 },
  modeLabel: { fontSize: 15, fontWeight: '800', color: '#242433' },
  modeLabelSelected: { color: '#fff' },
  modeHelp: { fontSize: 12, lineHeight: 17, color: '#6f6f82' },
  modeHelpSelected: { color: '#dedee9' },
  modeMark: { fontSize: 18, fontWeight: '800', color: '#555565' },
  buttonMuted: { opacity: 0.55 },
  successCard: { padding: 13, borderRadius: 12, backgroundColor: '#edf8ef' },
  successText: { fontSize: 13, fontWeight: '700', color: '#285c33' },
  errorCard: { padding: 13, borderRadius: 12, backgroundColor: '#fff0f0' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
  infoCard: { gap: 5, padding: 15, borderRadius: 15, backgroundColor: '#f0f0f6' },
  infoTitle: { fontSize: 13, fontWeight: '800', color: '#3d3d54' },
  muted: { fontSize: 13, lineHeight: 18, color: '#77778a' },
});
