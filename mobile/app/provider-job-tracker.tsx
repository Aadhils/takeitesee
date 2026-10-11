import { Link, Redirect, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { fetchJobTracker, applicationStatusLabel, type JobTracker } from '../lib/provider-job-tracker';
import { workspaceWebUrl } from '../lib/workspace-menu';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';
function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(); }
export default function ProviderJobTrackerScreen() {
  const auth = useAuth(), workspace = useWorkspace();
  const provider = workspace.profiles.find((profile) => profile.scope === 'professional');
  const userId = auth.status === 'signedIn' ? auth.identity.userId : '', entityId = provider?.media?.entity_id, key = `${userId}:${!!provider}:${entityId}`;
  const currentKey = useRef(key); currentKey.current = key;
  const epoch = useRef(0); const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: '', loading: true, tracker: null as JobTracker | null, error: '' });
  useFocusEffect(useCallback(() => {
    const version = ++epoch.current; setState({ key, loading: true, tracker: null, error: '' });
    if (userId && provider) void fetchJobTracker(userId, entityId).then((tracker) => { if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, tracker, error: '' }); }).catch((cause) => { if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, tracker: null, error: cause instanceof Error ? cause.message : 'Jobs could not load.' }); });
    return () => { epoch.current += 1; };
  }, [userId, key, !!provider, reload]));
  const visible = state.key === key ? state : null;
  const openWeb = async () => { const version = epoch.current; try { await Linking.openURL(workspaceWebUrl('/provider/jobs')); } catch { if (currentKey.current === key && epoch.current === version) setState((old) => ({ ...old, error: 'Website could not open. Please retry.' })); } };
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  return <SafeAreaView style={styles.safe}><View style={styles.screen}><View style={styles.brand}><BrandLogo compact /></View><ScrollView contentContainerStyle={styles.content}>
    <Link href="/provider" style={styles.link}>‹ Provider profile</Link><Text style={styles.title}>Your jobs & applications</Text><Text style={styles.help}>{provider?.name ?? 'Professional job tracker'} · Track your applications and saved opportunities.</Text>
    {workspace.loading || auth.status === 'loading' || (!!provider && (!visible || visible.loading)) ? <ActivityIndicator accessibilityLabel="Loading jobs" /> : null}
    {!provider && !workspace.loading ? <Text style={styles.error}>{workspace.error || 'Job tracking is available for a Professional identity.'}</Text> : null}
    {visible?.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
    {provider ? <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.button}><Text style={styles.link}>Reload jobs</Text></Pressable> : null}
    {visible?.tracker && provider ? <>
      <Text style={styles.heading}>My applications ({visible.tracker.applications.length})</Text>
      {!visible.tracker.applications.length ? <Text style={styles.help}>No applications yet. Browse and apply through the website below.</Text> : null}
      {visible.tracker.applications.map((application) => { const job = visible.tracker!.jobs.find(item => item.id === application.job_posting_id); return <View key={application.id} style={styles.card}><Text style={styles.heading}>{job?.title || 'Job details unavailable'}</Text><Text style={styles.link}>{applicationStatusLabel(application.status)}</Text><Text style={styles.help}>Applied: {dateLabel(application.applied_at)}</Text>{job ? <Text style={styles.help}>{[job.employment_type.replace(/_/g, ' '), job.workplace_type, job.location].filter(Boolean).join(' · ')}</Text> : null}{application.cover_note ? <Text style={styles.help}>Your cover note: {application.cover_note}</Text> : null}<Text style={styles.help}>Review interviews, offers and application actions on the website.</Text></View>; })}
      <Text style={styles.heading}>Saved jobs ({visible.tracker.saved.length})</Text>
      {!visible.tracker.saved.length ? <Text style={styles.help}>No saved jobs yet.</Text> : null}
      {visible.tracker.saved.map((saved) => <View key={saved.job_posting_id} style={styles.card}><Text style={styles.heading}>{saved.available && saved.job ? saved.job.title : 'Saved job unavailable'}</Text><Text style={styles.help}>Saved: {dateLabel(saved.saved_at)}</Text>{saved.available && saved.job ? <><Text style={styles.help}>{saved.job.business?.name || 'Business'} · {[saved.job.workplace_type, saved.job.location].filter(Boolean).join(' · ')}</Text><Text style={styles.help}>Application deadline: {saved.job.application_deadline || 'Not specified'}</Text><Text style={styles.help}>Available when last loaded. Eligibility and availability are rechecked when applying.</Text></> : <Text style={styles.help}>This listing is no longer available. Review or remove it through the website.</Text>}</View>)}
    </> : null}
    {provider ? <><Link href="/provider-career" style={styles.link}>Your résumé & career →</Link><Pressable accessibilityRole="link" onPress={() => void openWeb()} style={styles.button}><Text style={styles.link}>Browse & manage applications · opens website ↗</Text></Pressable><Text style={styles.help}>Apply, withdraw, saved-job changes, interviews and offers remain on the website. Sign in there with the same account if asked.</Text></> : null}
  </ScrollView><MobileNav /></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 }, brand: { alignItems: 'center' }, content: { gap: 14, paddingBottom: 16 }, title: { fontSize: 27, fontWeight: '900', color: theme.colors.ink }, heading: { fontSize: 18, fontWeight: '800', color: theme.colors.ink }, help: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted }, link: { minHeight: 44, paddingVertical: 12, color: theme.colors.primaryStrong, fontWeight: '800' }, card: { gap: 10, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16 }, button: { paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.colors.secondary }, error: { fontSize: 13, color: theme.colors.danger } });
