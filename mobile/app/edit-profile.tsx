import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { fetchProfileDetails, saveProfileDetails, validateProfileDraft, type ProfileDetails, type ProfileDraft } from '../lib/profile-details';
import { profileDestination, type ProfileScope } from '../lib/profile-model';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';

type State = { key: string; profile: ProfileDetails | null; draft: ProfileDraft | null; loading: boolean; saving: boolean; error: string; notice: string };
const empty: State = { key: '', profile: null, draft: null, loading: true, saving: false, error: '', notice: '' };
export default function EditProfileScreen() {
  const auth = useAuth(); const workspace = useWorkspace(); const router = useRouter();
  const { scope: requested } = useLocalSearchParams<{ scope?: string }>();
  const scope: ProfileScope = requested === 'professional' || requested === 'business' || requested === 'customer' ? requested : workspace.selectedScope;
  const owned = workspace.profiles.some((profile) => profile.scope === scope);
  const userId = auth.status === 'signedIn' ? auth.identity.userId : '';
  const key = `${userId}:${scope}`;
  const currentKey = useRef(key); currentKey.current = key;
  const epoch = useRef(0); const busy = useRef(false);
  const [reload, setReload] = useState(0); const [state, setState] = useState<State>(empty);
  useFocusEffect(useCallback(() => {
    const version = ++epoch.current; busy.current = false;
    setState({ ...empty, key });
    if (userId && owned) {
      void fetchProfileDetails(userId, scope).then((profile) => {
        if (currentKey.current === key && epoch.current === version) setState({ ...empty, key, profile, draft: profile, loading: false });
      }).catch((cause) => { if (currentKey.current === key && epoch.current === version) setState({ ...empty, key, loading: false, error: cause instanceof Error ? cause.message : 'Profile could not load.' }); });
    }
    return () => { epoch.current += 1; };
  }, [userId, scope, key, owned, reload]));
  const visible = state.key === key ? state : empty;
  const valid = (version: number) => currentKey.current === key && epoch.current === version;
  const save = async (version: number) => {
    if (!valid(version) || !owned || !visible.profile || !visible.draft || busy.current) return;
    busy.current = true; setState((old) => ({ ...old, saving: true, error: '', notice: '' }));
    try {
      const profile = await saveProfileDetails(userId, visible.profile, visible.draft);
      if (valid(version)) { setState((old) => ({ ...old, profile, draft: profile, saving: false, notice: profile.complete === false ? 'Profile saved. Your Provider profile is still incomplete; active services may be paused.' : 'Profile saved.' })); void workspace.refresh(); }
    } catch (cause) { if (valid(version)) setState((old) => ({ ...old, saving: false, error: cause instanceof Error ? cause.message : 'Save failed. Reload before retrying.' })); }
    finally { if (valid(version)) busy.current = false; }
  };
  const confirmSave = () => {
    if (!visible.draft || busy.current) return;
    try { validateProfileDraft(scope, visible.draft); }
    catch (cause) { setState((old) => ({ ...old, error: cause instanceof Error ? cause.message : 'Check your details.' })); return; }
    const version = epoch.current;
    if (scope !== 'customer' && visible.draft.description.trim().length < 20) {
      Alert.alert('Save an incomplete Provider profile?', 'A description with fewer than 20 characters leaves your profile incomplete. Existing active services may be paused by TakeItEsee.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Save profile', onPress: () => void save(version) }]);
    } else void save(version);
  };
  const update = (field: keyof ProfileDraft, value: string) => setState((old) => old.key === key && old.draft ? { ...old, draft: { ...old.draft, [field]: value }, notice: '' } : old);
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  const label = scope === 'customer' ? 'Customer' : scope === 'professional' ? 'Professional' : 'Business';
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.top}><Pressable accessibilityRole="button" style={styles.back} onPress={() => router.navigate(profileDestination(scope))}><Text style={styles.link}>‹ Profile</Text></Pressable><BrandLogo compact /><View style={styles.spacer} /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Edit {label} profile</Text><Text style={styles.help}>{scope === 'customer' ? 'Your Customer contact details are private account information.' : 'These details appear on your public Provider profile.'}</Text>
      {scope !== 'customer' ? <Text style={styles.help}>Changes that leave your Provider profile incomplete may pause active services. Saving a complete profile does not automatically reactivate paused services.</Text> : null}
      {!owned && !workspace.loading ? <Text accessibilityRole="alert" style={styles.error}>{workspace.error || 'This profile is unavailable. Return to your Profile and retry.'}</Text> : null}
      {(workspace.loading || auth.status === 'loading' || (owned && visible.loading)) ? <ActivityIndicator accessibilityLabel="Loading profile" /> : null}
      {owned && visible.draft ? <View style={styles.card}>
        <Text style={styles.label}>Display name</Text><TextInput accessibilityLabel={`${label} display name`} value={visible.draft.name} editable={!visible.saving} maxLength={120} onChangeText={(value) => update('name', value)} style={styles.input} />
        {scope === 'customer' ? <><Text style={styles.label}>Login email</Text><Text selectable style={styles.help}>{visible.profile?.email}</Text><Text style={styles.help}>Login email cannot be changed here.</Text><Text style={styles.label}>Phone</Text><TextInput accessibilityLabel="Customer phone" value={visible.draft.phone} keyboardType="phone-pad" editable={!visible.saving} maxLength={40} onChangeText={(value) => update('phone', value)} style={styles.input} /></> : <><Text style={styles.label}>Description</Text><TextInput accessibilityLabel="Provider description" value={visible.draft.description} multiline textAlignVertical="top" editable={!visible.saving} maxLength={1200} onChangeText={(value) => update('description', value)} style={[styles.input, styles.description]} /><Text style={styles.help}>{visible.draft.description.trim().length}/1200 · at least 20 characters for a complete profile</Text></>}
        <Text style={styles.label}>{scope === 'customer' ? 'Location' : 'Service area'}</Text><TextInput accessibilityLabel={scope === 'customer' ? 'Customer location' : 'Provider service area'} value={visible.draft.location} editable={!visible.saving} maxLength={160} onChangeText={(value) => update('location', value)} style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: visible.saving, busy: visible.saving }} disabled={visible.saving} onPress={confirmSave} style={[styles.save, visible.saving && styles.disabled]}><Text style={styles.saveText}>{visible.saving ? 'Saving…' : 'Save profile'}</Text></Pressable>
      </View> : null}
      {visible.notice ? <Text accessibilityLiveRegion="polite" style={styles.success}>{visible.notice}</Text> : null}
      {visible.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
      {owned && !visible.loading ? <Pressable accessibilityRole="button" disabled={visible.saving} onPress={() => setReload((value) => value + 1)} style={styles.back}><Text style={styles.link}>Reload saved profile</Text></Pressable> : null}
    </ScrollView><MobileNav />
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { minHeight: 44, minWidth: 80, justifyContent: 'center' }, spacer: { width: 80 },
  content: { gap: 14, paddingBottom: 18 }, title: { fontSize: 26, color: theme.colors.ink, fontWeight: '900' }, help: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  card: { padding: 16, gap: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16 }, label: { fontSize: 14, fontWeight: '800', color: theme.colors.ink },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12, fontSize: 16, color: theme.colors.ink, backgroundColor: theme.colors.white }, description: { minHeight: 130 },
  save: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: theme.colors.primary }, saveText: { fontWeight: '800', color: theme.colors.white },
  link: { color: theme.colors.primaryStrong, fontWeight: '800', fontSize: 13 }, error: { color: theme.colors.danger, fontSize: 13 }, success: { color: theme.colors.success, fontSize: 14 }, disabled: { opacity: 0.65 },
});
