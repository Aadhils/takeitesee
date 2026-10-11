import { Link, Redirect, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { fetchProviderReadiness, readinessGates, type ReadinessProfile } from '../lib/provider-readiness';
import { workspaceWebUrl } from '../lib/workspace-menu';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';
export default function ProviderReadinessScreen() {
  const auth = useAuth(), workspace = useWorkspace();
  const provider = workspace.profiles.find((profile) => profile.scope !== 'customer');
  const userId = auth.status === 'signedIn' ? auth.identity.userId : '';
  const key = `${userId}:${provider?.scope}:${provider?.media?.entity_id}`;
  const currentKey = useRef(key); currentKey.current = key;
  const epoch = useRef(0);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<{ key: string; loading: boolean; profile: ReadinessProfile | null; error: string }>({ key: '', loading: true, profile: null, error: '' });
  useFocusEffect(useCallback(() => {
    const version = ++epoch.current; setState({ key, loading: true, profile: null, error: '' });
    if (userId && provider && provider.scope !== 'customer') {
      void fetchProviderReadiness(userId, provider.scope, provider.media?.entity_id).then((profile) => {
        if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, profile, error: '' });
      }).catch((cause) => { if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, profile: null, error: cause instanceof Error ? cause.message : 'Readiness could not load.' }); });
    }
    return () => { epoch.current += 1; };
  }, [userId, key, reload]));
  const visible = state.key === key ? state : { loading: true, profile: null, error: '' };
  const openWeb = async () => {
    const version = epoch.current;
    try { await Linking.openURL(workspaceWebUrl('/provider/verification')); }
    catch { if (currentKey.current === key && epoch.current === version) setState((old) => ({ ...old, error: 'Website could not open. Please retry.' })); }
  };
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  const profile = visible.profile, gates = profile ? readinessGates(profile) : [];
  return <SafeAreaView style={styles.safe}><View style={styles.screen}>
    <View style={styles.brand}><BrandLogo compact /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Link href="/provider" style={styles.link}>‹ Provider profile</Link>
      <Text style={styles.title}>Public profile readiness</Text><Text style={styles.help}>Check the visibility requirements for your Professional or Business identity.</Text>
      {workspace.loading || auth.status === 'loading' || (!!provider && visible.loading) ? <ActivityIndicator accessibilityLabel="Checking readiness" /> : null}
      {!provider && !workspace.loading ? <Text style={styles.error}>{workspace.error || 'A Provider profile is required.'}</Text> : null}
      {visible.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
      {provider ? <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.button}><Text style={styles.link}>Reload readiness</Text></Pressable> : null}
      {profile ? <>
        <View style={styles.card}><Text style={styles.heading}>{profile.display_name}</Text><Text style={styles.heading}>{gates.filter((gate) => gate.done).length}/{gates.length} visibility gates complete</Text><Text style={styles.help}>{gates.every((gate) => gate.done) ? 'Public identity requirements are complete. Individual listings and public handles have their own approval rules.' : 'Complete the required items below before sharing your public identity.'}</Text></View>
        {gates.map((gate) => <View key={gate.label} style={styles.card}><Text style={styles.heading}>{gate.label}</Text><Text style={gate.done ? styles.success : styles.error}>{gate.done ? 'Complete' : 'Required'}</Text><Text style={styles.help}>{gate.detail}</Text></View>)}
        <View style={styles.card}><Text style={styles.heading}>Service launch quality</Text><Text style={styles.help}>Profile basics: {profile.profile_complete ? 'Complete' : 'Required for services'}</Text><Text style={styles.help}>{profile.services_active} active services · {profile.services_paused} paused services</Text><Text style={styles.help}>Active status alone does not confirm public listing visibility. Review category, location and activation approval in the service manager.</Text><Link href={{ pathname: '/edit-profile', params: { scope: profile.provider_type } }} style={styles.link}>Edit Provider details →</Link><Link href="/provider-services" style={styles.link}>Manage services →</Link></View>
        <Link href="/provider-verification" style={styles.link}>Verification review status →</Link><Link href="/provider-handle" style={styles.link}>Public handle →</Link>
        <Pressable accessibilityRole="link" onPress={() => void openWeb()} style={styles.button}><Text style={styles.link}>Manage evidence & disclosure · opens website ↗</Text></Pressable><Text style={styles.help}>The website may ask you to sign in with the same account. Career and portfolio settings remain in the website menu.</Text>
      </> : null}
    </ScrollView><MobileNav />
  </View></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 }, brand: { alignItems: 'center' }, content: { gap: 14, paddingBottom: 16 }, title: { fontSize: 27, fontWeight: '900', color: theme.colors.ink }, heading: { fontSize: 17, fontWeight: '800', color: theme.colors.ink }, help: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted }, link: { minHeight: 44, paddingVertical: 12, fontSize: 13, fontWeight: '800', color: theme.colors.primaryStrong }, card: { padding: 16, gap: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16 }, button: { paddingHorizontal: 14, borderRadius: 12, backgroundColor: theme.colors.secondary }, error: { fontSize: 13, color: theme.colors.danger }, success: { fontSize: 13, color: theme.colors.success },
});
