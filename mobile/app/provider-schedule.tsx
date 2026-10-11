import { Link, Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { fetchOwnedServices, type OwnedService } from '../lib/provider-services';
import { fetchWeeklySchedule, saveWeeklySchedule, ScheduleSaveUncertainError, type WeeklySchedule } from '../lib/provider-weekly-schedule';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const modes = [{ id: 'on_request', label: 'On request' }, { id: 'scheduled', label: 'Scheduled hours' }, { id: 'always_available', label: 'Always available' }] as const;
type State = { key: string; services: OwnedService[]; selected: string; original: WeeklySchedule | null; draft: WeeklySchedule | null; loading: boolean; saving: boolean; needsReload: boolean; error: string; notice: string };
const empty: State = { key: '', services: [], selected: '', original: null, draft: null, loading: true, saving: false, needsReload: false, error: '', notice: '' };
export default function ProviderScheduleScreen() {
  const auth = useAuth(), workspace = useWorkspace(); const { serviceId: requested } = useLocalSearchParams<{ serviceId?: string }>();
  const profile = workspace.profiles.find((item) => item.scope !== 'customer');
  const scope = profile?.scope === 'professional' ? 'professional' : 'business';
  const userId = auth.status === 'signedIn' ? auth.identity.userId : '', key = `${userId}:${profile?.scope ?? ''}`;
  const currentKey = useRef(key); currentKey.current = key;
  const epoch = useRef(0), busy = useRef(false);
  const [state, setState] = useState<State>(empty), [reload, setReload] = useState(0);
  const valid = (version: number) => currentKey.current === key && epoch.current === version;
  useFocusEffect(useCallback(() => {
    const version = ++epoch.current; busy.current = false; setState({ ...empty, key });
    if (userId && profile) void (async () => {
      try {
        const services = await fetchOwnedServices(userId, scope);
        const selected = services.find((service) => service.id === requested)?.id ?? services[0]?.id ?? '';
        if (currentKey.current !== key || epoch.current !== version) return;
        setState((old) => ({ ...old, services, selected }));
        const schedule = selected ? await fetchWeeklySchedule(userId, selected) : null;
        if (currentKey.current === key && epoch.current === version) setState({ ...empty, key, services, selected, original: schedule, draft: schedule, loading: false });
      } catch (cause) { if (currentKey.current === key && epoch.current === version) setState((old) => ({ ...old, loading: false, error: cause instanceof Error ? cause.message : 'Schedule could not load.' })); }
    })();
    return () => { epoch.current += 1; };
  }, [userId, key, scope, !!profile, requested, reload]));
  const visible = state.key === key ? state : empty;
  const select = async (serviceId: string) => {
    if (busy.current || !visible.services.some((service) => service.id === serviceId)) return;
    const version = ++epoch.current;
    setState((old) => ({ ...old, selected: serviceId, original: null, draft: null, loading: true, needsReload: false, error: '', notice: '' }));
    try { const schedule = await fetchWeeklySchedule(userId, serviceId); if (valid(version)) setState((old) => ({ ...old, original: schedule, draft: schedule, loading: false })); }
    catch (cause) { if (valid(version)) setState((old) => ({ ...old, loading: false, error: cause instanceof Error ? cause.message : 'Schedule could not load.' })); }
  };
  const edit = (change: (draft: WeeklySchedule) => WeeklySchedule) => setState((old) => old.key === key && old.draft && !old.saving && !old.needsReload ? { ...old, draft: change(old.draft), notice: '' } : old);
  const save = async () => {
    if (!visible.original || !visible.draft || busy.current || visible.needsReload) return;
    const version = epoch.current; busy.current = true; setState((old) => ({ ...old, saving: true, error: '', notice: '' }));
    try { const schedule = await saveWeeklySchedule(userId, scope, visible.original, visible.draft); if (valid(version)) setState((old) => ({ ...old, saving: false, original: schedule, draft: schedule, notice: 'Working hours saved.' })); }
    catch (cause) { if (valid(version)) setState((old) => ({ ...old, saving: false, needsReload: cause instanceof ScheduleSaveUncertainError, error: cause instanceof Error ? cause.message : 'Schedule could not save.' })); }
    finally { if (valid(version)) busy.current = false; }
  };
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  const locked = visible.saving || visible.needsReload;
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.brand}><BrandLogo compact /></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Link href="/provider" style={styles.link}>‹ Provider profile</Link><Text style={styles.title}>Weekly working hours</Text><Text style={styles.help}>Choose a service and set its availability in the service timezone.</Text>
      {!profile && !workspace.loading ? <Text accessibilityRole="alert" style={styles.error}>{workspace.error || 'A Professional or Business profile is required.'}</Text> : null}
      <ScrollView horizontal contentContainerStyle={styles.row}>{visible.services.map((service) => <Pressable key={service.id} accessibilityRole="button" accessibilityState={{ selected: visible.selected === service.id }} disabled={visible.saving} onPress={() => void select(service.id)} style={[styles.secondary, visible.selected === service.id && styles.selected]}><Text style={styles.link}>{service.name}</Text></Pressable>)}</ScrollView>
      {workspace.loading || auth.status === 'loading' || (!!profile && visible.loading) ? <ActivityIndicator accessibilityLabel="Loading working hours" /> : null}
      {visible.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}{visible.notice ? <Text accessibilityLiveRegion="polite" style={styles.success}>{visible.notice}</Text> : null}
      {profile && !visible.loading ? <Pressable accessibilityRole="button" disabled={visible.saving} onPress={() => visible.selected ? void select(visible.selected) : setReload((value) => value + 1)} style={styles.secondary}><Text style={styles.link}>Reload saved hours</Text></Pressable> : null}
      {visible.draft ? <>
        <View style={styles.card}><Text style={styles.label}>Timezone: {visible.draft.timezone}</Text><Text style={styles.help}>Timezone is preserved. Enter 24-hour times; the end must be later on the same day.</Text>{modes.map((mode) => <Pressable key={mode.id} accessibilityRole="button" accessibilityState={{ selected: visible.draft?.mode === mode.id }} disabled={locked} onPress={() => edit((draft) => ({ ...draft, mode: mode.id }))} style={[styles.secondary, visible.draft?.mode === mode.id && styles.selected]}><Text style={styles.link}>{mode.label}</Text></Pressable>)}<Text style={styles.help}>Weekly hours apply in Scheduled mode. Other modes keep your saved hours for later use.</Text></View>
        {days.map((day, dayIndex) => <View key={day} style={styles.card}><Text style={styles.heading}>{day}</Text>{visible.draft!.weekly_windows.map((window, index) => window.day_of_week === dayIndex ? <View key={index} style={styles.window}><Text style={styles.label}>Start</Text><TextInput accessibilityLabel={`${day} window ${index + 1} start time`} value={window.start_time} editable={!locked} maxLength={8} placeholder="09:00" keyboardType="numbers-and-punctuation" onChangeText={(value) => edit((draft) => ({ ...draft, weekly_windows: draft.weekly_windows.map((row, i) => i === index ? { ...row, start_time: value } : row) }))} style={styles.input} /><Text style={styles.label}>End</Text><TextInput accessibilityLabel={`${day} window ${index + 1} end time`} value={window.end_time} editable={!locked} maxLength={8} placeholder="17:00" keyboardType="numbers-and-punctuation" onChangeText={(value) => edit((draft) => ({ ...draft, weekly_windows: draft.weekly_windows.map((row, i) => i === index ? { ...row, end_time: value } : row) }))} style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${day} working-hours window ${index + 1}`} disabled={locked} onPress={() => edit((draft) => ({ ...draft, weekly_windows: draft.weekly_windows.filter((_, i) => i !== index) }))} style={styles.secondary}><Text style={styles.link}>Remove window</Text></Pressable></View> : null)}{!visible.draft!.weekly_windows.some((window) => window.day_of_week === dayIndex) ? <Text style={styles.help}>No scheduled hours</Text> : null}<Pressable accessibilityRole="button" disabled={locked} onPress={() => edit((draft) => ({ ...draft, weekly_windows: [...draft.weekly_windows, { day_of_week: dayIndex, start_time: '09:00', end_time: '17:00' }] }))} style={styles.secondary}><Text style={styles.link}>Add {day} hours +</Text></Pressable></View>)}
        <Text style={styles.help}>{visible.draft.blackout_periods.length} existing blackout period(s) will be preserved. This editor changes weekly hours and availability mode only.</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ busy: visible.saving, disabled: locked }} disabled={locked} onPress={() => void save()} style={[styles.primary, locked && styles.disabled]}><Text style={styles.white}>{visible.saving ? 'Saving…' : visible.needsReload ? 'Reload saved hours before saving' : 'Save working hours'}</Text></Pressable>
      </> : !visible.loading && !visible.error && profile ? <Text style={styles.help}>Add a service draft before configuring working hours.</Text> : null}
    </ScrollView><MobileNav />
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 }, brand: { alignItems: 'center' }, content: { gap: 14, paddingBottom: 16 }, row: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 27, fontWeight: '900', color: theme.colors.ink }, heading: { fontSize: 18, fontWeight: '800', color: theme.colors.ink }, label: { fontSize: 14, fontWeight: '800', color: theme.colors.ink }, help: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted }, link: { fontSize: 13, fontWeight: '800', color: theme.colors.primaryStrong },
  card: { padding: 16, gap: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16 }, window: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderColor: theme.colors.border }, input: { minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12, color: theme.colors.ink, fontSize: 16 },
  primary: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, borderRadius: 12 }, secondary: { minHeight: 44, padding: 12, justifyContent: 'center', backgroundColor: theme.colors.secondary, borderRadius: 12 }, selected: { borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.selected }, white: { color: theme.colors.white, fontWeight: '800' }, error: { color: theme.colors.danger, fontSize: 13 }, success: { color: theme.colors.success, fontSize: 13 }, disabled: { opacity: 0.6 },
});
