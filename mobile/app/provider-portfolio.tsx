import { Link, Redirect, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { fetchPortfolio, portfolioImageUrl, type PortfolioItem } from '../lib/provider-portfolio';
import { workspaceWebUrl } from '../lib/workspace-menu';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';
export default function ProviderPortfolioScreen() {
  const auth = useAuth(), workspace = useWorkspace();
  const provider = workspace.profiles.find((profile) => profile.scope === 'professional');
  const userId = auth.status === 'signedIn' ? auth.identity.userId : '', entityId = provider?.media?.entity_id, key = `${userId}:${!!provider}:${entityId}`;
  const currentKey = useRef(key); currentKey.current = key;
  const epoch = useRef(0); const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: '', loading: true, media: [] as PortfolioItem[], error: '' });
  const [failedImages, setFailedImages] = useState<string[]>([]);
  useFocusEffect(useCallback(() => {
    const version = ++epoch.current; setState({ key, loading: true, media: [], error: '' }); setFailedImages([]);
    if (userId && provider) void fetchPortfolio(userId, entityId).then((media) => { if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, media, error: '' }); }).catch((cause) => { if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, media: [], error: cause instanceof Error ? cause.message : 'Portfolio could not load.' }); });
    return () => { epoch.current += 1; };
  }, [userId, key, !!provider, reload]));
  const visible = state.key === key ? state : null;
  const openWeb = async () => { const version = epoch.current; try { await Linking.openURL(workspaceWebUrl('/provider/portfolio')); } catch { if (currentKey.current === key && epoch.current === version) setState((old) => ({ ...old, error: 'Website could not open. Please retry.' })); } };
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  return <SafeAreaView style={styles.safe}><View style={styles.screen}><View style={styles.brand}><BrandLogo compact /></View><ScrollView contentContainerStyle={styles.content}>
    <Link href="/provider" style={styles.link}>‹ Provider profile</Link><Text style={styles.title}>Your work showcase</Text><Text style={styles.help}>{provider?.name ?? 'Professional portfolio'} · Review your own images, captions and media status.</Text>
    {workspace.loading || auth.status === 'loading' || (!!provider && (!visible || visible.loading)) ? <ActivityIndicator accessibilityLabel="Loading portfolio" /> : null}
    {!provider && !workspace.loading ? <Text style={styles.error}>{workspace.error || 'Portfolio is available for a Professional identity.'}</Text> : null}
    {visible?.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
    {provider ? <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.button}><Text style={styles.link}>Reload gallery</Text></Pressable> : null}
    {visible && !visible.loading && !visible.error && provider && !visible.media.length ? <View style={styles.card}><Text style={styles.heading}>Show customers your work</Text><Text style={styles.help}>No portfolio media yet. Add work samples through the website manager below.</Text></View> : null}
    {visible?.media.map((item) => {
      const url = portfolioImageUrl(item), version = epoch.current;
      return <View key={item.id} style={styles.card}>{url && !failedImages.includes(item.id) ? <Image source={{ uri: url }} accessibilityLabel={item.alt_text || item.caption || 'Your portfolio work sample'} style={styles.image} resizeMode="contain" onError={() => { if (currentKey.current === key && epoch.current === version) setFailedImages((old) => old.includes(item.id) ? old : [...old, item.id]); }} /> : <Text style={styles.help}>{item.media_type === 'video' ? 'Video sample · view and manage on the website' : 'Preview unavailable. Reload gallery to refresh the temporary image link.'}</Text>}<Text style={styles.heading}>{item.caption || (item.media_type === 'video' ? 'Video sample' : 'Work sample')}</Text><Text style={styles.help}>{item.active ? 'Active' : 'Hidden by you'} · {item.moderation_state === 'clear' ? 'Moderation clear' : item.moderation_state === 'paused' ? 'Paused by moderation' : 'Moderation status unavailable'}</Text>{item.alt_text ? <Text style={styles.help}>Image description: {item.alt_text}</Text> : null}<Link href={{ pathname: '/portfolio-text-editor', params: { id: item.id } }} style={styles.link}>Edit caption{item.media_type === 'image' ? ' & image description' : ''} →</Link></View>;
    })}
    {provider ? <><Text style={styles.help}>This is your private management preview. Public visibility still depends on verification, disclosure, trust and moderation.</Text><Link href="/provider-readiness" style={styles.link}>Public profile readiness →</Link><Pressable accessibilityRole="link" onPress={() => void openWeb()} style={styles.button}><Text style={styles.link}>Upload, remove & manage portfolio · opens website ↗</Text></Pressable><Text style={styles.help}>The website may ask you to sign in with the same account.</Text></> : null}
  </ScrollView><MobileNav /></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 }, brand: { alignItems: 'center' }, content: { gap: 14, paddingBottom: 16 }, title: { fontSize: 27, fontWeight: '900', color: theme.colors.ink }, heading: { fontSize: 18, fontWeight: '800', color: theme.colors.ink }, help: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted }, link: { minHeight: 44, paddingVertical: 12, color: theme.colors.primaryStrong, fontWeight: '800' }, card: { gap: 10, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16 }, button: { paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.colors.secondary }, image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: theme.colors.secondary }, error: { fontSize: 13, color: theme.colors.danger } });
