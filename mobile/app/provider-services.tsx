import { Link, Redirect, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { fetchOwnedServices, fetchServiceCategories, saveOwnedService, ServiceSaveUncertainError, type OwnedService, type ServiceCategory, type ServiceDraft } from '../lib/provider-services';
import { theme } from '../lib/theme';
import { workspaceWebUrl } from '../lib/workspace-menu';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';

type Editor = { id?: string; draft: ServiceDraft };
type State = { key: string; services: OwnedService[]; categories: ServiceCategory[]; loading: boolean; error: string; notice: string; editor: Editor | null; saving: boolean; needsReload: boolean };
const empty: State = { key: '', services: [], categories: [], loading: true, error: '', notice: '', editor: null, saving: false, needsReload: false };
const newDraft = (): ServiceDraft => ({ name: '', description: '', categoryId: '', location: '', duration: '60', price: '', currency: 'INR' });
export default function ProviderServicesScreen() {
  const auth = useAuth(); const workspace = useWorkspace();
  const profile = workspace.profiles.find((item) => item.scope !== 'customer');
  const scope = profile?.scope === 'professional' ? 'professional' : 'business';
  const userId = auth.status === 'signedIn' ? auth.identity.userId : '';
  const key = `${userId}:${profile?.scope ?? ''}`;
  const currentKey = useRef(key); currentKey.current = key;
  const epoch = useRef(0), busy = useRef(false);
  const [reload, setReload] = useState(0), [state, setState] = useState<State>(empty);
  const [categorySearch, setCategorySearch] = useState('');
  useFocusEffect(useCallback(() => {
    const version = ++epoch.current; busy.current = false; setCategorySearch(''); setState({ ...empty, key });
    if (userId && profile) {
      void Promise.all([fetchOwnedServices(userId, scope), fetchServiceCategories(userId)]).then(([services, categories]) => { if (currentKey.current === key && epoch.current === version) setState({ ...empty, key, services, categories, loading: false }); }).catch((cause) => { if (currentKey.current === key && epoch.current === version) setState({ ...empty, key, loading: false, error: cause instanceof Error ? cause.message : 'Services could not load.' }); });
    }
    return () => { epoch.current += 1; };
  }, [userId, key, scope, !!profile, reload]));
  const visible = state.key === key ? state : empty;
  const draft = visible.editor?.draft;
  const openWeb = async (path: string) => {
    const version = epoch.current;
    try { await Linking.openURL(workspaceWebUrl(path)); }
    catch { if (currentKey.current === key && epoch.current === version) setState((old) => ({ ...old, error: 'Website could not open. Please retry.' })); }
  };
  const update = (field: keyof ServiceDraft, value: string) => setState((old) => old.key === key && old.editor ? { ...old, editor: { ...old.editor, draft: { ...old.editor.draft, [field]: value } } } : old);
  const save = async () => {
    if (!visible.editor || !profile || busy.current || visible.needsReload) return;
    const version = epoch.current; busy.current = true; setState((old) => ({ ...old, saving: true, error: '', notice: '' }));
    try {
      const service = await saveOwnedService(userId, scope, visible.editor.draft, visible.categories, visible.editor.id);
      if (currentKey.current === key && epoch.current === version) setState((old) => ({ ...old, saving: false, editor: null, services: [service, ...old.services.filter((item) => item.id !== service.id)], notice: visible.editor?.id ? 'Service details saved.' : 'Service saved as draft. Complete approval on Provider Setup before activation.' }));
    } catch (cause) { if (currentKey.current === key && epoch.current === version) setState((old) => ({ ...old, saving: false, needsReload: cause instanceof ServiceSaveUncertainError, error: cause instanceof Error ? cause.message : 'Service could not save.' })); }
    finally { if (currentKey.current === key && epoch.current === version) busy.current = false; }
  };
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.brand}><BrandLogo compact /></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Link href="/provider" style={styles.link}>‹ Provider profile</Link><Text style={styles.title}>Manage services</Text><Text style={styles.help}>{profile?.name ?? 'Your Provider profile'} · Create drafts and edit service details.</Text>
      {workspace.loading || auth.status === 'loading' || (!!profile && visible.loading) ? <ActivityIndicator accessibilityLabel="Loading services" /> : null}
      {!profile && !workspace.loading ? <Text accessibilityRole="alert" style={styles.error}>{workspace.error || 'A Professional or Business profile is required.'}</Text> : null}
      {visible.notice ? <Text accessibilityLiveRegion="polite" style={styles.success}>{visible.notice}</Text> : null}{visible.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
      {profile && !visible.loading ? <>
        <Pressable accessibilityRole="button" disabled={visible.saving} onPress={() => { setState((old) => ({ ...old, editor: null })); setReload((value) => value + 1); }} style={styles.secondary}><Text style={styles.link}>Reload services</Text></Pressable>
        {!visible.editor ? <Pressable accessibilityRole="button" disabled={!!visible.error || visible.needsReload} onPress={() => { setCategorySearch(''); setState((old) => ({ ...old, editor: { draft: newDraft() }, error: '', notice: '' })); }} style={[styles.primary, (!!visible.error || visible.needsReload) && styles.disabled]}><Text style={styles.white}>Add service draft</Text></Pressable> : null}
      </> : null}
      {draft ? <View style={styles.card}><Text style={styles.heading}>{visible.editor?.id ? 'Edit service' : 'New service draft'}</Text>
        <Text style={styles.label}>Service name</Text><TextInput accessibilityLabel="Service name" value={draft.name} maxLength={200} editable={!visible.saving} onChangeText={(value) => update('name', value)} style={styles.input} />
        <Text style={styles.label}>Description</Text><TextInput accessibilityLabel="Service description" value={draft.description} maxLength={4000} multiline textAlignVertical="top" editable={!visible.saving} onChangeText={(value) => update('description', value)} style={[styles.input, styles.multiline]} />
        <Text style={styles.label}>Specialty category</Text><Text style={styles.help}>{visible.editor?.id ? 'Choose a category to replace it, or keep the existing category.' : 'Choose a specific category from the Services marketplace.'}</Text>
        {visible.editor?.id ? <Pressable accessibilityRole="button" disabled={visible.saving} onPress={() => update('categoryId', '')} style={styles.secondary}><Text style={styles.link}>Keep existing category</Text></Pressable> : null}
        <TextInput accessibilityLabel="Search specialty categories" placeholder="Search categories…" value={categorySearch} editable={!visible.saving} onChangeText={setCategorySearch} style={styles.input} />
        {draft.categoryId ? <Text style={styles.link}>Selected: {visible.categories.find((item) => item.id === draft.categoryId)?.name}</Text> : null}
        <ScrollView style={styles.categoryList} nestedScrollEnabled>{visible.categories.filter((item) => item.name.toLowerCase().includes(categorySearch.trim().toLowerCase())).map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: draft.categoryId === item.id }} disabled={visible.saving} onPress={() => update('categoryId', item.id)} style={[styles.category, draft.categoryId === item.id && styles.selected]}><Text style={styles.link}>{item.name}{draft.categoryId === item.id ? ' ✓' : ''}</Text></Pressable>)}</ScrollView>
        <Text style={styles.label}>Location / service area</Text><TextInput accessibilityLabel="Service location" value={draft.location} maxLength={160} editable={!visible.saving} onChangeText={(value) => update('location', value)} style={styles.input} />
        <Text style={styles.label}>Duration in minutes</Text><TextInput accessibilityLabel="Service duration in minutes" value={draft.duration} keyboardType="number-pad" editable={!visible.saving} onChangeText={(value) => update('duration', value)} style={styles.input} />
        <Text style={styles.label}>Listing price ({draft.currency})</Text><TextInput accessibilityLabel="Service listing price" value={draft.price} keyboardType="decimal-pad" editable={!visible.saving} onChangeText={(value) => update('price', value)} style={styles.input} />
        <View style={styles.row}>{(['INR', 'USD'] as const).map((currency) => <Pressable key={currency} accessibilityRole="button" accessibilityState={{ selected: currency === draft.currency }} disabled={visible.saving} onPress={() => update('currency', currency)} style={[styles.secondary, currency === draft.currency && styles.selected]}><Text style={styles.link}>{currency}</Text></Pressable>)}</View>
        <Text style={styles.help}>{visible.editor?.id ? 'This saves details without changing draft, active or paused status.' : 'New services are saved as drafts.'} Category or location changes may require approval before the service is publicly discoverable.</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ busy: visible.saving, disabled: visible.saving || visible.needsReload }} disabled={visible.saving || visible.needsReload} onPress={() => void save()} style={[styles.primary, (visible.saving || visible.needsReload) && styles.disabled]}><Text style={styles.white}>{visible.saving ? 'Saving…' : visible.needsReload ? 'Reload services before saving' : 'Save service'}</Text></Pressable><Pressable accessibilityRole="button" disabled={visible.saving} onPress={() => setState((old) => ({ ...old, editor: null, error: old.needsReload ? old.error : '' }))} style={styles.secondary}><Text style={styles.link}>Cancel</Text></Pressable>
      </View> : visible.services.map((service) => <View key={service.id} style={styles.card}><Text style={styles.heading}>{service.name}</Text><Text style={styles.badge}>{service.status.toUpperCase()}</Text><Text style={styles.help}>{service.description}</Text><Text style={styles.help}>{service.category || 'Category not set'} · {service.location || 'Location not set'}</Text><Text style={styles.label}>{service.currency} {service.base_price} · {service.duration_minutes} minutes</Text><Text style={styles.help}>{service.public_discoverable === true ? 'Visible in public discovery' : service.public_discoverable === false ? 'Not currently visible in public discovery' : 'Reload to check public discovery'}</Text><Pressable accessibilityRole="button" onPress={() => { setCategorySearch(''); setState((old) => ({ ...old, editor: { id: service.id, draft: { name: service.name, description: service.description, categoryId: '', location: service.location ?? '', price: String(service.base_price), duration: String(service.duration_minutes), currency: service.currency } }, error: '', notice: '' })); }} style={styles.secondary}><Text style={styles.link}>Edit service details →</Text></Pressable></View>)}
      {!visible.loading && !visible.error && profile && !visible.services.length && !draft ? <Text style={styles.help}>No services yet. Add your first service as a draft.</Text> : null}
      <Text style={styles.help}>Verification, category/location approval and activation remain available through Provider Setup and the service manager on the website.</Text>
      <Pressable accessibilityRole="link" onPress={() => void openWeb('/provider/setup')} style={styles.secondary}><Text style={styles.link}>Provider Setup · opens website ↗</Text></Pressable>
      <Pressable accessibilityRole="link" onPress={() => void openWeb('/provider/services')} style={styles.secondary}><Text style={styles.link}>Activation & listing status · opens website ↗</Text></Pressable><Text style={styles.help}>The website may ask you to sign in with the same account.</Text>
    </ScrollView><MobileNav />
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, padding: 18, paddingTop: 12, paddingBottom: 10, gap: 10 }, brand: { alignItems: 'center' }, content: { gap: 14, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', color: theme.colors.ink }, heading: { fontSize: 18, fontWeight: '800', color: theme.colors.ink }, help: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted }, label: { fontSize: 14, fontWeight: '800', color: theme.colors.ink },
  card: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: 16, gap: 12 }, input: { minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12, fontSize: 16, color: theme.colors.ink }, multiline: { minHeight: 120 },
  primary: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, borderRadius: 12 }, secondary: { minHeight: 44, padding: 12, justifyContent: 'center', backgroundColor: theme.colors.secondary, borderRadius: 12 }, white: { color: theme.colors.white, fontWeight: '800' }, link: { color: theme.colors.primaryStrong, fontWeight: '800', fontSize: 13 }, row: { flexDirection: 'row', gap: 12 },
  categoryList: { maxHeight: 180 }, category: { minHeight: 44, padding: 12, borderBottomWidth: 1, borderColor: theme.colors.border }, selected: { backgroundColor: theme.colors.selected, borderWidth: 1, borderColor: theme.colors.primary }, badge: { alignSelf: 'flex-start', color: theme.colors.primaryStrong, backgroundColor: theme.colors.secondary, padding: 6, borderRadius: 8, fontWeight: '800', fontSize: 11 }, error: { color: theme.colors.danger, fontSize: 13 }, success: { color: theme.colors.success, fontSize: 13 }, disabled: { opacity: 0.6 },
});
