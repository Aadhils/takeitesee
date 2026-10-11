import { Link, Redirect, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { accountLanguages, fetchExperiencePreferences, saveExperiencePreferences, type ExperiencePreferences } from '../lib/experience-preferences';
import { workspaceWebUrl } from '../lib/workspace-menu';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
type State = { owner: string; loading: boolean; busy: boolean; uncertain: boolean; form: ExperiencePreferences | null; error: string; notice: string };
const empty: State = { owner: '', loading: true, busy: false, uncertain: false, form: null, error: '', notice: '' };
export default function ExperiencePreferencesScreen() {
 const auth = useAuth(), userId = auth.status === 'signedIn' ? auth.identity.userId : '';
 const currentOwner = useRef(userId); currentOwner.current = userId;
 const epoch = useRef(0), busy = useRef(false);
 const [reload, setReload] = useState(0), [state, setState] = useState<State>(empty);
 useFocusEffect(useCallback(() => {
  const version = ++epoch.current; busy.current = false; setState({ ...empty, owner: userId });
  if (userId) void fetchExperiencePreferences(userId).then(form => { if (currentOwner.current === userId && epoch.current === version) setState({ ...empty, owner: userId, loading: false, form }); }).catch(cause => { if (currentOwner.current === userId && epoch.current === version) setState({ ...empty, owner: userId, loading: false, error: cause instanceof Error ? cause.message : 'Preferences could not load.' }); });
  return () => { epoch.current += 1; };
 }, [userId, reload]));
 const visible = state.owner === userId ? state : empty;
 const disabled = visible.loading || visible.busy || visible.uncertain;
 const save = async () => {
  if (!userId || !visible.form || disabled || busy.current) return;
  const version = epoch.current; busy.current = true; setState(old => ({ ...old, busy: true, notice: '', error: '' }));
  try { const form = await saveExperiencePreferences(userId, visible.form); if (currentOwner.current === userId && epoch.current === version) setState(old => ({ ...old, form, busy: false, notice: 'Account preferences saved.' })); }
  catch (cause) { if (currentOwner.current === userId && epoch.current === version) setState(old => ({ ...old, busy: false, uncertain: true, error: `${cause instanceof Error ? cause.message : 'Save could not be confirmed.'} Reload to review saved values.` })); }
  finally { if (currentOwner.current === userId && epoch.current === version) busy.current = false; }
 };
 const openWeb = async () => { const version = epoch.current; try { await Linking.openURL(workspaceWebUrl('/account/settings')); } catch { if (currentOwner.current === userId && epoch.current === version) setState(old => ({ ...old, error: 'Website could not open. Please retry.' })); } };
 if (auth.status === 'signedOut') return <Redirect href="/login" />;
 return <SafeAreaView style={styles.safe}><View style={styles.screen}><View style={styles.brand}><BrandLogo compact /></View><ScrollView contentContainerStyle={styles.content}>
  <Link href="/settings" style={styles.link}>‹ Settings & privacy</Link><Text style={styles.title}>Language & accessibility</Text>
  <Text style={styles.help}>These account preferences are shared with the website and across your profiles. The native interface is currently in English. Native text size and motion follow your device accessibility settings.</Text>
  {visible.loading ? <ActivityIndicator accessibilityLabel="Loading account preferences" /> : null}
  {visible.form ? <View style={styles.card}><Text style={styles.heading}>Preferred account language</Text><View accessibilityRole="radiogroup" style={styles.languages}>{accountLanguages.map(language => <Pressable key={language} accessibilityRole="radio" accessibilityState={{ checked: visible.form!.preferredLanguage === language, disabled }} disabled={disabled} style={[styles.option, visible.form!.preferredLanguage === language && styles.selected]} onPress={() => setState(old => old.owner === userId && old.form ? { ...old, form: { ...old.form, preferredLanguage: language }, notice: '' } : old)}><Text style={styles.link}>{language === 'Tamil' ? 'தமிழ் · Tamil' : language}</Text></Pressable>)}</View><Text style={styles.help}>Saving a language preference does not translate every screen. English/Tamil coverage depends on the website; Hindi/Malayalam remain selectable account preferences.</Text>
  {([{ key: 'reducedMotion', label: 'Reduced website motion' }, { key: 'largerText', label: 'Larger website text' }] as const).map(item => <View key={item.key} style={styles.row}><Text style={styles.label}>{item.label}</Text><Switch accessibilityLabel={item.label} disabled={disabled} value={visible.form![item.key]} onValueChange={value => setState(old => old.owner === userId && old.form ? { ...old, form: { ...old.form, [item.key]: value }, notice: '' } : old)} /></View>)}
  <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: visible.busy }} disabled={disabled} onPress={() => void save()} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{visible.busy ? 'Saving…' : 'Save account preferences'}</Text></Pressable></View> : null}
  {visible.notice ? <Text accessibilityLiveRegion="polite" style={styles.success}>{visible.notice}</Text> : null}{visible.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
  <Pressable accessibilityRole="button" disabled={visible.busy || auth.status !== 'signedIn'} onPress={() => setReload(value => value + 1)} style={styles.option}><Text style={styles.link}>Reload preferences</Text></Pressable>
  <Pressable accessibilityRole="link" onPress={() => void openWeb()} style={styles.option}><Text style={styles.link}>Account settings · opens website ↗</Text></Pressable>
 </ScrollView><MobileNav /></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 }, brand: { alignItems: 'center' }, content: { gap: 14, paddingBottom: 16 }, title: { fontSize: 27, fontWeight: '900', color: theme.colors.ink }, heading: { fontSize: 18, fontWeight: '800', color: theme.colors.ink }, help: { fontSize: 13, lineHeight: 20, color: theme.colors.inkMuted }, link: { minHeight: 44, paddingVertical: 12, color: theme.colors.primaryStrong, fontWeight: '800' }, card: { gap: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16 }, languages: { gap: 8 }, option: { paddingHorizontal: 12, minHeight: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12 }, selected: { backgroundColor: theme.colors.secondary, borderColor: theme.colors.primary }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }, label: { flex: 1, color: theme.colors.ink, fontSize: 15, fontWeight: '700' }, button: { minHeight: 48, backgroundColor: theme.colors.primary, borderRadius: 12, justifyContent: 'center', alignItems: 'center', padding: 12 }, buttonText: { color: theme.colors.white, fontWeight: '800' }, disabled: { opacity: 0.6 }, error: { color: theme.colors.danger }, success: { color: theme.colors.success } });
