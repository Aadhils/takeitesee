import { Link, Redirect, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { fetchVerificationStatus, verificationStatusLabel, type VerificationStatus } from '../lib/provider-verification';
import { workspaceWebUrl } from '../lib/workspace-menu';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';
const fieldLabels: Record<string, string> = { legal_name: 'Legal name', principal_address: 'Principal address', public_contact_email: 'Public contact email', public_contact_phone: 'Public contact phone', grievance_officer_name: 'Grievance officer name', grievance_officer_designation: 'Grievance officer designation', grievance_email: 'Grievance email', grievance_phone: 'Grievance phone' };
export default function ProviderVerificationScreen() {
  const auth = useAuth(), workspace = useWorkspace();
  const provider = workspace.profiles.find((profile) => profile.scope !== 'customer');
  const scope = provider?.scope === 'professional' ? 'professional' : 'business';
  const userId = auth.status === 'signedIn' ? auth.identity.userId : '', entityId = provider?.media?.entity_id, key = `${userId}:${provider?.scope}:${entityId}`;
  const currentKey = useRef(key); currentKey.current = key;
  const epoch = useRef(0); const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: '', loading: true, data: null as VerificationStatus | null, error: '' });
  useFocusEffect(useCallback(() => {
    const version = ++epoch.current; setState({ key, loading: true, data: null, error: '' });
    if (userId && provider) void fetchVerificationStatus(userId, scope, entityId).then((data) => { if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, data, error: '' }); }).catch((cause) => { if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, data: null, error: cause instanceof Error ? cause.message : 'Verification could not load.' }); });
    return () => { epoch.current += 1; };
  }, [userId, key, scope, !!provider, reload]));
  const visible = state.key === key ? state : null;
  const openWeb = async () => { const version = epoch.current; try { await Linking.openURL(workspaceWebUrl('/provider/verification')); } catch { if (currentKey.current === key && epoch.current === version) setState((old) => ({ ...old, error: 'Website could not open. Please retry.' })); } };
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  const data = visible?.data;
  return <SafeAreaView style={styles.safe}><View style={styles.screen}><View style={styles.brand}><BrandLogo compact /></View><ScrollView contentContainerStyle={styles.content}>
    <Link href="/provider" style={styles.link}>‹ Provider profile</Link><Text style={styles.title}>Verification status</Text><Text style={styles.help}>Track review progress for your {scope === 'professional' ? 'Professional' : 'Business'} identity.</Text>
    {workspace.loading || auth.status === 'loading' || (!!provider && (!visible || visible.loading)) ? <ActivityIndicator accessibilityLabel="Loading verification" /> : null}
    {!provider && !workspace.loading ? <Text style={styles.error}>{workspace.error || 'A Provider profile is required.'}</Text> : null}
    {visible?.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
    {provider ? <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.button}><Text style={styles.link}>Reload verification</Text></Pressable> : null}
    {data ? <>
      <View style={styles.card}><Text style={styles.heading}>{data.name}</Text><Text style={data.verified ? styles.success : styles.error}>{data.verified ? 'Provider identity verified' : 'Provider identity not verified'}</Text><Text style={styles.help}>Verification alone does not confirm public visibility. Disclosure, trust and listing approval rules also apply.</Text><Link href="/provider-readiness" style={styles.link}>Public profile readiness →</Link></View>
      <View style={styles.card}><Text style={styles.heading}>Marketplace disclosure</Text><Text style={data.disclosureComplete ? styles.success : styles.error}>{data.disclosureComplete ? 'Complete' : 'Required information missing'}</Text>{data.missingFields.map((field) => <Text key={field} style={styles.help}>• {fieldLabels[field] ?? 'Additional disclosure information'}</Text>)}</View>
      <Text style={styles.heading}>Review history</Text>{!data.requests.length ? <Text style={styles.help}>No verification requests for this Provider identity yet.</Text> : data.requests.map((request) => <View key={request.id} style={styles.card}><Text style={styles.heading}>{verificationStatusLabel(request.status)}</Text><Text style={styles.help}>Submitted: {Number.isNaN(Date.parse(request.createdAt)) ? 'Date unavailable' : new Date(request.createdAt).toLocaleDateString()}</Text><Text style={styles.help}>{request.documentCount} active document(s)</Text>{request.note ? <Text selectable style={styles.help}>Reviewer note: {request.note}</Text> : null}{request.status === 'pending' ? <Text style={styles.help}>Awaiting platform review. Check here for updates.</Text> : request.status === 'changes_requested' ? <Text style={styles.help}>Review the note and update your evidence on the website.</Text> : null}</View>)}
      <Pressable accessibilityRole="link" onPress={() => void openWeb()} style={styles.button}><Text style={styles.link}>Manage evidence & disclosure · opens website ↗</Text></Pressable><Text style={styles.help}>Submit documents, update disclosure or withdraw a pending request on the website. Sign in with the same account if asked.</Text>
    </> : null}
  </ScrollView><MobileNav /></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 }, brand: { alignItems: 'center' }, content: { gap: 14, paddingBottom: 16 }, title: { fontSize: 27, fontWeight: '900', color: theme.colors.ink }, heading: { fontSize: 18, fontWeight: '800', color: theme.colors.ink }, help: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted }, link: { minHeight: 44, paddingVertical: 12, color: theme.colors.primaryStrong, fontWeight: '800' }, card: { gap: 10, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16 }, button: { paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.colors.secondary }, error: { fontSize: 13, color: theme.colors.danger }, success: { fontSize: 13, color: theme.colors.success } });
