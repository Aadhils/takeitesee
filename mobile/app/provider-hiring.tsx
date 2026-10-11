import { Link, Redirect, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { applicationStatusLabel } from '../lib/provider-job-tracker';
import { fetchHiring, hiringJobStatus, type HiringPreview } from '../lib/provider-hiring';
import { workspaceWebUrl } from '../lib/workspace-menu';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';
function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(); }
export default function ProviderHiringScreen() {
  const auth = useAuth(), workspace = useWorkspace();
  const provider = workspace.profiles.find((profile) => profile.scope === 'business');
  const userId = auth.status === 'signedIn' ? auth.identity.userId : '', entityId = provider?.media?.entity_id, key = `${userId}:${!!provider}:${entityId}`;
  const currentKey = useRef(key); currentKey.current = key;
  const epoch = useRef(0); const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: '', loading: true, tracker: null as HiringPreview | null, error: '' });
  useFocusEffect(useCallback(() => {
    const version = ++epoch.current; setState({ key, loading: true, tracker: null, error: '' });
    if (userId && provider) void fetchHiring(userId, entityId).then((tracker) => { if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, tracker, error: '' }); }).catch((cause) => { if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, tracker: null, error: cause instanceof Error ? cause.message : 'Hiring could not load.' }); });
    return () => { epoch.current += 1; };
  }, [userId, key, !!provider, reload]));
  const visible = state.key === key ? state : null;
  const openWeb = async () => { const version = epoch.current; try { await Linking.openURL(workspaceWebUrl('/provider/jobs')); } catch { if (currentKey.current === key && epoch.current === version) setState((old) => ({ ...old, error: 'Website could not open. Please retry.' })); } };
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  return <SafeAreaView style={styles.safe}><View style={styles.screen}><View style={styles.brand}><BrandLogo compact /></View><ScrollView contentContainerStyle={styles.content}>
    <Link href="/provider" style={styles.link}>‹ Provider profile</Link><Text style={styles.title}>Your hiring workspace</Text><Text style={styles.help}>{provider?.name ?? 'Business hiring'} · Review your listings and applicant status.</Text>
    {workspace.loading || auth.status === 'loading' || (!!provider && (!visible || visible.loading)) ? <ActivityIndicator accessibilityLabel="Loading jobs" /> : null}
    {!provider && !workspace.loading ? <Text style={styles.error}>{workspace.error || 'Hiring is available for a Business identity.'}</Text> : null}
    {visible?.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
    {provider ? <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.button}><Text style={styles.link}>Reload hiring</Text></Pressable> : null}
    {visible?.tracker && provider ? <>
      <Text style={styles.heading}>Job listings ({visible.tracker.jobs.length})</Text>
      {!visible.tracker.jobs.length ? <Text style={styles.help}>No listings yet. Create your first job through the website below.</Text> : null}
      {visible.tracker.jobs.map((job) => { const applicants = visible.tracker!.applicants.filter(row => row.job_posting_id === job.id); return <View key={job.id} style={styles.card}><Text style={styles.heading}>{job.title}</Text><Text style={styles.help}>{hiringJobStatus(job.status)} · {job.moderation_state === 'clear' ? 'Moderation clear' : job.moderation_state === 'paused' ? 'Paused by moderation' : 'Moderation status unavailable'}</Text><Text style={styles.help}>{[job.employment_type.replace(/_/g, ' '),job.workplace_type,job.location].filter(Boolean).join(' · ')}</Text><Text style={styles.help}>Openings: {job.openings} · Deadline: {job.application_deadline || 'Not specified'}</Text><Text style={styles.heading}>Applicants ({applicants.length})</Text>{!applicants.length ? <Text style={styles.help}>No applications for this listing yet.</Text> : null}{applicants.map((application) => { const person = visible.tracker!.professionals.find(row => row.id === application.professional_id); return <View key={application.id} style={styles.applicant}><Text style={styles.heading}>{person?.headline || 'Professional applicant'}</Text><Text style={styles.help}>{applicationStatusLabel(application.status)} · Applied {dateLabel(application.applied_at)}</Text>{person ? <Text style={styles.help}>{person.verified ? 'Verified Professional' : 'Professional verification not confirmed'}{person.service_area ? ` · ${person.service_area}` : ''}</Text> : <Text style={styles.help}>Applicant profile summary unavailable.</Text>}</View>; })}</View>; })}
    </> : null}
    {provider ? <><Text style={styles.help}>This is your private hiring overview. An Open listing status alone does not establish public discoverability.</Text><Pressable accessibilityRole="link" onPress={() => void openWeb()} style={styles.button}><Text style={styles.link}>Manage hiring & review résumés · opens website ↗</Text></Pressable><Text style={styles.help}>Create/edit/publish jobs, applicant actions, résumé review, interviews and offers remain on the website. Sign in there with the same account if asked.</Text></> : null}
  </ScrollView><MobileNav /></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 }, brand: { alignItems: 'center' }, content: { gap: 14, paddingBottom: 16 }, title: { fontSize: 27, fontWeight: '900', color: theme.colors.ink }, heading: { fontSize: 18, fontWeight: '800', color: theme.colors.ink }, help: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted }, link: { minHeight: 44, paddingVertical: 12, color: theme.colors.primaryStrong, fontWeight: '800' }, applicant: { gap: 5, paddingTop: 12, borderTopWidth: 1, borderColor: theme.colors.border }, card: { gap: 10, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16 }, button: { paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.colors.secondary }, error: { fontSize: 13, color: theme.colors.danger } });
