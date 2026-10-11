import { Link, Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { fetchProviderHandle, saveProviderHandle, normalizeHandle, publicHandleUrl, HandleSaveUncertainError, type ProviderHandle } from '../lib/provider-handle';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';
export default function ProviderHandleScreen() {
  const auth = useAuth(), workspace = useWorkspace();
  const provider = workspace.profiles.find((profile) => profile.scope !== 'customer');
  const scope = provider?.scope === 'professional' ? 'professional' : 'business';
  const userId = auth.status === 'signedIn' ? auth.identity.userId : '', key = `${userId}:${provider?.scope}`;
  const currentKey = useRef(key); currentKey.current = key;
  const epoch = useRef(0), busy = useRef(false);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: '', loading: true, saving: false, locked: false, input: '', data: null as ProviderHandle | null, error: '', notice: '' });
  useFocusEffect(useCallback(() => {
    const version = ++epoch.current; busy.current = false; setState({ key, loading: true, saving: false, locked: false, input: '', data: null, error: '', notice: '' });
    if (userId && provider) void fetchProviderHandle(userId, scope).then((data) => { if (currentKey.current === key && epoch.current === version) setState({ key, loading: false, saving: false, locked: false, input: data.handle ?? '', data, error: '', notice: '' }); }).catch((cause) => { if (currentKey.current === key && epoch.current === version) setState((old) => ({ ...old, loading: false, error: cause instanceof Error ? cause.message : 'Handle could not load.' })); });
    return () => { epoch.current += 1; };
  }, [userId, key, scope, !!provider, reload]));
  const visible = state.key === key ? state : null;
  const save = async (version: number, input: string) => {
    if (!visible?.data || busy.current || visible.locked || epoch.current !== version || currentKey.current !== key) return;
    busy.current = true; setState((old) => ({ ...old, saving: true, error: '', notice: '' }));
    try { const data = await saveProviderHandle(userId, scope, visible.data.handle, input); if (epoch.current === version && currentKey.current === key) setState((old) => ({ ...old, data, input: data.handle ?? '', saving: false, notice: data.public_profile_ready ? 'Handle saved. Your public identity is ready.' : 'Handle reserved. Complete public profile readiness before sharing.' })); }
    catch (cause) { if (epoch.current === version && currentKey.current === key) setState((old) => ({ ...old, saving: false, locked: cause instanceof HandleSaveUncertainError, error: cause instanceof Error ? cause.message : 'Handle could not save.' })); }
    finally { if (epoch.current === version && currentKey.current === key) busy.current = false; }
  };
  const confirm = () => {
    if (!visible?.data || visible.saving || visible.locked) return;
    try {
      const input = normalizeHandle(visible.input), version = epoch.current;
      if (input === visible.data.handle) { setState((old) => ({ ...old, notice: 'This is already your saved handle.' })); return; }
      Alert.alert('Save public handle?', visible.data.handle ? 'This changes your public address. Retired handles remain reserved and cannot be reclaimed through this editor.' : 'This reserves a unique public address for your Provider identity. Verification is still required for public visibility.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Save handle', onPress: () => void save(version, input) }]);
    } catch (cause) { setState((old) => ({ ...old, error: cause instanceof Error ? cause.message : 'Invalid handle.' })); }
  };
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  const url = visible?.data ? publicHandleUrl(visible.data) : null;
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.brand}><BrandLogo compact /></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Link href="/provider" style={styles.link}>‹ Provider profile</Link><Text style={styles.title}>Public handle</Text><Text style={styles.help}>A unique address for {provider?.name ?? 'your Provider identity'}.</Text>
    {workspace.loading || auth.status === 'loading' || (!!provider && (!visible || visible.loading)) ? <ActivityIndicator accessibilityLabel="Loading public handle" /> : null}
    {!provider && !workspace.loading ? <Text style={styles.error}>{workspace.error || 'A Provider profile is required.'}</Text> : null}
    {visible?.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}{visible?.notice ? <Text accessibilityLiveRegion="polite" style={styles.help}>{visible.notice}</Text> : null}
    {provider ? <Pressable accessibilityRole="button" disabled={visible?.saving} onPress={() => setReload((value) => value + 1)} style={styles.secondary}><Text style={styles.link}>Reload saved handle</Text></Pressable> : null}
    {visible?.data ? <View style={styles.card}><Text style={styles.heading}>{visible.data.handle ? `@${visible.data.handle}` : 'No handle set'}</Text><Text style={styles.help}>{visible.data.public_profile_ready ? 'Public identity ready' : 'Public visibility requirements pending'}</Text><TextInput accessibilityLabel="Provider public handle" value={visible.input} editable={!visible.saving && !visible.locked} maxLength={30} autoCapitalize="none" autoCorrect={false} placeholder="your-name" onChangeText={(input) => setState((old) => ({ ...old, input, notice: '' }))} style={styles.input} /><Text style={styles.help}>3–30 letters, numbers and single hyphens. Availability and reserved names are checked by the server.</Text><Pressable accessibilityRole="button" disabled={visible.saving || visible.locked} onPress={confirm} style={styles.primary}><Text style={styles.white}>{visible.saving ? 'Saving…' : visible.locked ? 'Reload before saving' : 'Save handle'}</Text></Pressable>
      {url ? <><Text selectable style={styles.help}>{url}</Text><Pressable accessibilityRole="button" onPress={() => void Share.share({ message: url }).catch(() => { if (currentKey.current === key) setState((old) => ({ ...old, error: 'Sharing could not open.' })); })} style={styles.secondary}><Text style={styles.link}>Share public profile →</Text></Pressable></> : <Text style={styles.help}>A reserved handle does not make your profile public.</Text>}
      <Link href="/provider-readiness" style={styles.link}>Public profile readiness →</Link>
    </View> : null}
  </ScrollView><MobileNav /></KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 }, brand: { alignItems: 'center' }, content: { gap: 14, paddingBottom: 16 }, title: { fontSize: 27, fontWeight: '900', color: theme.colors.ink }, heading: { fontSize: 18, fontWeight: '800', color: theme.colors.ink }, help: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted }, link: { minHeight: 44, paddingVertical: 12, color: theme.colors.primaryStrong, fontWeight: '800' }, card: { gap: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16 }, input: { minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12, fontSize: 16, color: theme.colors.ink }, primary: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: theme.colors.primary }, secondary: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.colors.secondary }, white: { color: theme.colors.white, fontWeight: '800' }, error: { color: theme.colors.danger, fontSize: 13 } });
