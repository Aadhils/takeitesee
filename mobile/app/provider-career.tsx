import { Link, Redirect, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { fetchCareer, type CareerData } from '../lib/provider-career';
import { workspaceWebUrl } from '../lib/workspace-menu';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';
export default function ProviderCareerScreen() {
  const auth = useAuth(), workspace = useWorkspace();
  const provider = workspace.profiles.find((profile) => profile.scope === 'professional');
  const userId = auth.status === 'signedIn' ? auth.identity.userId : '', entityId = provider?.media?.entity_id, key = `${userId}:${!!provider}:${entityId}`;
  const currentKey = useRef(key); currentKey.current = key;
  const epoch = useRef(0); const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: '', loading: true, career: null as CareerData | null, error: '' });
  useFocusEffect(useCallback(() => {
    const version = ++epoch.current; setState({ key, loading: true, career: null, error: '' });
    if (userId && provider) void fetchCareer(userId, entityId).then((career) => { if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, career, error: '' }); }).catch((cause) => { if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, career: null, error: cause instanceof Error ? cause.message : 'Résumé could not load.' }); });
    return () => { epoch.current += 1; };
  }, [userId, key, !!provider, reload]));
  const visible = state.key === key ? state : null;
  const openWeb = async () => { const version = epoch.current; try { await Linking.openURL(workspaceWebUrl('/provider/resume')); } catch { if (currentKey.current === key && epoch.current === version) setState((old) => ({ ...old, error: 'Website could not open. Please retry.' })); } };
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  return <SafeAreaView style={styles.safe}><View style={styles.screen}><View style={styles.brand}><BrandLogo compact /></View><ScrollView contentContainerStyle={styles.content}>
    <Link href="/provider" style={styles.link}>‹ Provider profile</Link><Text style={styles.title}>Your résumé & career</Text><Text style={styles.help}>{provider?.name ?? 'Professional résumé'} · Review your career profile, experience and skills.</Text>
    {workspace.loading || auth.status === 'loading' || (!!provider && (!visible || visible.loading)) ? <ActivityIndicator accessibilityLabel="Loading résumé" /> : null}
    {!provider && !workspace.loading ? <Text style={styles.error}>{workspace.error || 'Résumé is available for a Professional identity.'}</Text> : null}
    {visible?.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
    {provider ? <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.button}><Text style={styles.link}>Reload résumé</Text></Pressable> : null}
    {visible?.career && provider ? <>
      <View style={styles.card}><Text style={styles.heading}>{visible.career.career_profile?.career_headline || 'Career profile'}</Text><Text style={styles.help}>{visible.career.career_profile?.career_summary || 'No career summary yet.'}</Text><Text style={styles.help}>Public résumé preference: {visible.career.career_profile?.public_resume_enabled ? 'Enabled' : 'Disabled'}. This preference does not establish public visibility.</Text></View>
      <View style={styles.card}><Text style={styles.heading}>Career availability</Text>{visible.career.career_profile ? <><Text style={styles.help}>Preferred location: {visible.career.career_profile.preferred_location || 'Not specified'}</Text><Text style={styles.help}>Remote work: {visible.career.career_profile.open_to_remote ? 'Open' : 'Not selected'} · Relocation: {visible.career.career_profile.willing_to_relocate ? 'Willing' : 'Not selected'}</Text><Text style={styles.help}>Available from: {visible.career.career_profile.available_from || 'Not specified'} · Notice: {visible.career.career_profile.notice_period_days === null ? 'Not specified' : `${visible.career.career_profile.notice_period_days} days`}</Text>{visible.career.career_profile.availability_note ? <Text style={styles.help}>{visible.career.career_profile.availability_note}</Text> : null}</> : <Text style={styles.help}>Add your career preferences through the website.</Text>}</View>
      {(['experiences', 'education', 'certifications', 'skills'] as const).map((section) => <View key={section} style={styles.card}><Text style={styles.heading}>{({ experiences: 'Experience', education: 'Education', certifications: 'Certifications', skills: 'Skills' })[section]}</Text>{!visible.career![section].length ? <Text style={styles.help}>No entries yet.</Text> : visible.career![section].map((item) => <View key={item.id} style={{ gap: 4 }}><Text style={styles.heading}>{item.role_title || item.qualification || item.name}</Text><Text style={styles.help}>{[item.organization, item.institution, item.field_of_study, item.issuing_organization, item.proficiency, item.years_experience != null ? `${item.years_experience} years` : null].filter(Boolean).join(' · ')}</Text>{item.start_date || item.end_date || item.issue_date || item.expiry_date ? <Text style={styles.help}>{item.start_date || item.issue_date || 'Not specified'} → {item.is_current ? 'Present' : item.end_date || item.expiry_date || 'Not specified'}</Text> : null}{item.description ? <Text style={styles.help}>{item.description}</Text> : null}</View>)}</View>)}
      <View style={styles.card}><Text style={styles.heading}>Professional roles</Text>{visible.career.roles.length ? visible.career.roles.map((role) => <Text key={role.id} style={styles.help}>{role.title} · {role.active ? 'Active' : 'Inactive'}</Text>) : <Text style={styles.help}>No roles yet.</Text>}</View>
    </> : null}
    {provider ? <><Link href="/career-summary-editor" style={styles.link}>Edit career headline & summary →</Link><Text style={styles.help}>This is your private résumé preview. Public visibility depends on the existing verification, disclosure and trust requirements.</Text><Link href="/provider-readiness" style={styles.link}>Public profile readiness →</Link><Pressable accessibilityRole="link" onPress={() => void openWeb()} style={styles.button}><Text style={styles.link}>Edit résumé & export PDF · opens website ↗</Text></Pressable><Text style={styles.help}>The website may ask you to sign in with the same account.</Text></> : null}
  </ScrollView><MobileNav /></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 }, brand: { alignItems: 'center' }, content: { gap: 14, paddingBottom: 16 }, title: { fontSize: 27, fontWeight: '900', color: theme.colors.ink }, heading: { fontSize: 18, fontWeight: '800', color: theme.colors.ink }, help: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted }, link: { minHeight: 44, paddingVertical: 12, color: theme.colors.primaryStrong, fontWeight: '800' }, card: { gap: 10, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16 }, button: { paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.colors.secondary }, image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: theme.colors.secondary }, error: { fontSize: 13, color: theme.colors.danger } });
