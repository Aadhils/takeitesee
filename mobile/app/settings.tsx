import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { fetchAccountPreferences, saveAccountPreferences, type AccountPreferences } from '../lib/account-settings';
import { profileDestination } from '../lib/profile-model';
import { cardShadow, theme } from '../lib/theme';
import { workspaceWebUrl } from '../lib/workspace-menu';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';

const preferences: { key: keyof AccountPreferences; label: string; help: string }[] = [
  { key: 'notifyBookingUpdates', label: 'Booking updates', help: 'Updates about your service bookings.' },
  { key: 'notifyReviewReminders', label: 'Review reminders', help: 'Reminders to share feedback after a service.' },
  { key: 'notifyProductUpdates', label: 'Product information', help: 'Optional TakeItEsee product updates.' },
  { key: 'useHistoryForRecommendations', label: 'Personalised recommendations', help: 'Use your activity history for recommendations.' },
];
const pages = [
  { label: 'Edit Customer details', path: '/account/profile', help: 'Name, phone and location' },
  { label: 'Language & accessibility', path: '/account/settings', help: 'Manage your saved account preferences' },
  { label: 'Password & security', path: '/account/security', help: 'Securely verify and change your password' },
  { label: 'Privacy requests & account deletion', path: '/account/privacy', help: 'Submit and track a request for review' },
  { label: 'Privacy Policy', path: '/privacy', help: 'How your information is handled' },
  { label: 'Terms of Service', path: '/terms', help: 'Using TakeItEsee' },
  { label: 'Cookie Policy', path: '/cookies', help: 'Website cookie information' },
];
type State = { owner: string; form: AccountPreferences | null; loading: boolean; busy: boolean; error: string; notice: string };
const empty: State = { owner: '', form: null, loading: true, busy: false, error: '', notice: '' };

export default function SettingsScreen() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const router = useRouter();
  const userId = auth.status === 'signedIn' ? auth.identity.userId : '';
  const [state, setState] = useState<State>(empty);
  const [reload, setReload] = useState(0);
  const epoch = useRef(0);
  const busy = useRef(false);
  const currentOwner = useRef(userId);
  currentOwner.current = userId;
  const currentOperation = (owner: string, version: number) => owner === currentOwner.current && epoch.current === version;
  useFocusEffect(useCallback(() => {
    const version = ++epoch.current;
    busy.current = false;
    if (userId) {
      setState({ ...empty, owner: userId });
      void fetchAccountPreferences(userId).then((form) => {
        if (currentOwner.current === userId && epoch.current === version) setState({ ...empty, owner: userId, form, loading: false });
      }).catch((cause) => {
        if (currentOwner.current === userId && epoch.current === version) setState({ ...empty, owner: userId, loading: false, error: cause instanceof Error ? cause.message : 'Settings could not load.' });
      });
    }
    return () => { epoch.current += 1; };
  }, [userId, reload]));
  const visible = state.owner === userId ? state : empty;
  const save = async () => {
    if (!userId || !visible.form || busy.current || visible.loading) return;
    const version = epoch.current;
    busy.current = true;
    setState((old) => ({ ...old, busy: true, error: '', notice: '' }));
    try {
      const form = await saveAccountPreferences(userId, visible.form);
      if (currentOperation(userId, version)) setState((old) => ({ ...old, form, busy: false, notice: 'Settings saved.' }));
    } catch (cause) {
      if (currentOperation(userId, version)) setState((old) => ({ ...old, busy: false, error: cause instanceof Error ? cause.message : 'Settings could not be saved.' }));
    } finally {
      if (currentOperation(userId, version)) busy.current = false;
    }
  };
  const openWeb = async (path: string) => {
    const version = epoch.current;
    try { await Linking.openURL(workspaceWebUrl(path)); }
    catch { if (currentOperation(userId, version)) setState((old) => ({ ...old, error: 'This website page could not open. Please retry.' })); }
  };
  const signOut = () => Alert.alert('Sign out?', 'Sign out of your Customer and Provider profiles on this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => {
      if (busy.current || currentOwner.current !== userId) return;
      const version = epoch.current;
      busy.current = true;
      setState((old) => ({ ...old, busy: true, error: '' }));
      void auth.signOut().catch(() => { if (currentOperation(userId, version)) { busy.current = false; setState((old) => ({ ...old, busy: false, error: 'Sign out failed. Please retry.' })); } });
    } },
  ]);
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  return <SafeAreaView style={styles.safe}><View style={styles.screen}>
    <View style={styles.top}><Pressable accessibilityRole="button" onPress={() => router.navigate(profileDestination(workspace.selectedScope))} style={styles.back}><Text style={styles.linkText}>‹ Profile</Text></Pressable><BrandLogo compact /><View style={styles.spacer} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings & privacy</Text><Text style={styles.help}>These preferences belong to your account and are shared across your profiles.</Text>
      {visible.loading ? <View style={styles.loading}><ActivityIndicator /><Text style={styles.help}>Loading settings…</Text></View> : null}
      {visible.form ? <View style={styles.card}><Text style={styles.cardTitle}>Notifications & recommendations</Text>{preferences.map((item) => <View key={item.key} style={styles.preference}><View style={styles.copy}><Text style={styles.label}>{item.label}</Text><Text style={styles.help}>{item.help}</Text></View><Switch accessibilityLabel={item.label} value={visible.form![item.key]} disabled={visible.busy} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} onValueChange={(value) => setState((old) => old.owner === userId && old.form ? { ...old, form: { ...old.form, [item.key]: value }, notice: '' } : old)} /></View>)}<Pressable accessibilityRole="button" accessibilityState={{ disabled: visible.busy, busy: visible.busy }} disabled={visible.busy} onPress={() => void save()} style={[styles.save, visible.busy && styles.disabled]}><Text style={styles.saveText}>{visible.busy ? 'Please wait…' : 'Save preferences'}</Text></Pressable></View> : null}
      {visible.notice ? <Text accessibilityLiveRegion="polite" style={styles.success}>{visible.notice}</Text> : null}
      {visible.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
      {!visible.loading && !visible.form ? <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.back}><Text style={styles.linkText}>Retry settings</Text></Pressable> : null}
      <View style={styles.card}><Text style={styles.cardTitle}>Account & privacy</Text>{pages.map((page) => <Pressable key={page.path} accessibilityRole="link" accessibilityLabel={`${page.label}, opens website`} onPress={() => void openWeb(page.path)} style={({ pressed }) => [styles.webRow, pressed && styles.disabled]}><Text style={styles.label}>{page.label}</Text><Text style={styles.help}>{page.help}</Text><Text style={styles.linkText}>Opens website ↗</Text></Pressable>)}<Text style={styles.help}>Website pages may ask you to sign in with the same account. Deletion requests are reviewed; they do not immediately delete your account.</Text></View>
      <Pressable accessibilityRole="button" disabled={visible.busy || auth.status !== 'signedIn'} onPress={signOut} style={styles.signOut}><Text style={styles.linkText}>Sign out</Text></Pressable>
    </ScrollView><MobileNav />
  </View></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, spacer: { width: 80 }, back: { minHeight: 44, minWidth: 80, justifyContent: 'center' },
  content: { gap: 14, paddingBottom: 12 }, title: { fontSize: 28, fontWeight: '900', color: theme.colors.ink },
  card: { gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.white, ...cardShadow },
  cardTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.ink }, preference: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 }, copy: { flex: 1, minWidth: 0, gap: 4 },
  label: { fontSize: 15, fontWeight: '800', color: theme.colors.ink }, help: { fontSize: 12, lineHeight: 18, color: theme.colors.inkMuted },
  loading: { flexDirection: 'row', gap: 10 }, save: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: theme.colors.primary }, saveText: { color: theme.colors.white, fontWeight: '800' },
  webRow: { minHeight: 72, gap: 5, paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.colors.border }, linkText: { color: theme.colors.primaryStrong, fontSize: 13, fontWeight: '800' },
  success: { color: theme.colors.success, fontSize: 14 }, error: { color: theme.colors.danger, fontSize: 13 }, signOut: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: theme.colors.secondary }, disabled: { opacity: 0.65 },
});
