import { Link, Redirect, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { fetchPrivacyRequests, submitPrivacyRequest, privacyRequestInput, privacyRequestTypes, privacyStatusLabel, privacyTypeLabel, type PrivacyRequest, type PrivacyRequestType } from '../lib/privacy-requests';
import { workspaceWebUrl } from '../lib/workspace-menu';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
type State = { owner: string; loading: boolean; busy: boolean; uncertain: boolean; requests: PrivacyRequest[]; type: PrivacyRequestType; details: string; error: string; notice: string };
const empty: State = { owner: '', loading: true, busy: false, uncertain: false, requests: [], type: 'access', details: '', error: '', notice: '' };
function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(); }
export default function PrivacyRequestsScreen() {
 const auth = useAuth(), userId = auth.status === 'signedIn' ? auth.identity.userId : '';
 const owner = useRef(userId); owner.current = userId;
 const epoch = useRef(0), busy = useRef(false), uncertain = useRef(false);
 const [reload, setReload] = useState(0), [state, setState] = useState<State>(empty);
 const current = (account: string, version: number) => owner.current === account && epoch.current === version;
 useFocusEffect(useCallback(() => {
  const version = ++epoch.current; setState({ ...empty, owner: userId, busy: busy.current, uncertain: uncertain.current });
  if (userId) void fetchPrivacyRequests(userId).then(requests => { if (owner.current === userId && epoch.current === version) { uncertain.current = false; setState({ ...empty, owner: userId, loading: false, busy: busy.current, requests }); } }).catch(cause => { if (owner.current === userId && epoch.current === version) setState({ ...empty, owner: userId, loading: false, busy: busy.current, uncertain: uncertain.current, error: cause instanceof Error ? cause.message : 'Request history could not load.' }); });
  return () => { epoch.current += 1; };
 }, [userId, reload]));
 const visible = state.owner === userId ? state : empty, disabled = visible.loading || visible.busy || visible.uncertain || auth.status !== 'signedIn';
 const send = async (account: string, version: number, type: PrivacyRequestType, details: string) => {
  if (!current(account, version) || busy.current || uncertain.current || disabled) return;
  busy.current = true; setState(old => ({ ...old, busy: true, error: '', notice: '' }));
  try { const request = await submitPrivacyRequest(account, type, details); if (current(account, version)) setState(old => ({ ...old, busy: false, details: '', requests: [request, ...old.requests.filter(row => row.id !== request.id)], notice: 'Your request was recorded for review. This does not immediately delete your account.' })); }
  catch (cause) { if (owner.current === account) uncertain.current = true; if (current(account, version)) setState(old => ({ ...old, busy: false, uncertain: true, error: `${cause instanceof Error ? cause.message : 'Submission could not be confirmed.'} Reload history before submitting again.` })); }
  finally { busy.current = false; const needsReload = owner.current === account && epoch.current !== version; if (needsReload) uncertain.current = true; setState(old => old.owner === owner.current ? { ...old, busy: false, ...(needsReload ? { uncertain: true, error: 'A previous submission finished after this screen refreshed. Reload history before submitting again.' } : {}) } : old); }
 };
 const confirm = () => {
  if (disabled || busy.current) return;
  try { privacyRequestInput(visible.type, visible.details); } catch (cause) { setState(old => ({ ...old, error: cause instanceof Error ? cause.message : 'Check your request details.' })); return; }
  const version = epoch.current, type = visible.type, details = visible.details;
  Alert.alert(type === 'deletion' ? 'Submit account deletion request?' : 'Submit privacy request?', 'This records a request for review. It does not immediately delete your account or change your information.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Submit request', onPress: () => void send(userId, version, type, details) }]);
 };
 const openWeb = async () => { const version = epoch.current; try { await Linking.openURL(workspaceWebUrl('/account/privacy')); } catch { if (current(userId, version)) setState(old => ({ ...old, error: 'Website could not open. Please retry.' })); } };
 if (auth.status === 'signedOut') return <Redirect href="/login" />;
 return <SafeAreaView style={styles.safe}><View style={styles.screen}><View style={styles.brand}><BrandLogo compact /></View><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
  <Link href="/settings" style={styles.link}>‹ Settings & privacy</Link><Text style={styles.title}>Privacy requests</Text><Text style={styles.help}>Request access, correction or account deletion. Requests are reviewed; submission does not immediately delete your account.</Text>
  {visible.loading ? <ActivityIndicator accessibilityLabel="Loading privacy requests" /> : null}
  <View style={styles.card}><Text style={styles.heading}>New request</Text><View accessibilityRole="radiogroup">{privacyRequestTypes.map(type => <Pressable key={type} accessibilityRole="radio" accessibilityState={{ checked: visible.type === type, disabled }} disabled={disabled} style={[styles.option, visible.type === type && styles.selected]} onPress={() => setState(old => old.owner === userId ? { ...old, type, notice: '' } : old)}><Text style={styles.link}>{privacyTypeLabel(type)}</Text></Pressable>)}</View><Text style={styles.heading}>Request details</Text><TextInput accessibilityLabel="Privacy request details" multiline textAlignVertical="top" editable={!disabled} value={visible.details} maxLength={2000} placeholder="Describe what you need reviewed (10–2000 characters)" placeholderTextColor={theme.colors.inkMuted} style={styles.input} onChangeText={details => setState(old => old.owner === userId ? { ...old, details, notice: '' } : old)} /><Text style={styles.help}>Include enough context for review. Do not include passwords, payment details or unnecessary identity documents.</Text><Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: visible.busy }} disabled={disabled} onPress={confirm} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{visible.busy ? 'Submitting…' : 'Submit request for review'}</Text></Pressable></View>
  {visible.notice ? <Text accessibilityLiveRegion="polite" style={styles.success}>{visible.notice}</Text> : null}{visible.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
  <Pressable accessibilityRole="button" disabled={visible.busy || busy.current || auth.status !== 'signedIn'} onPress={() => setReload(value => value + 1)} style={styles.option}><Text style={styles.link}>Reload request history</Text></Pressable>
  <Text style={styles.heading}>Your request history</Text>{!visible.loading && !visible.requests.length && !visible.error ? <Text style={styles.help}>No privacy requests yet.</Text> : null}
  {visible.requests.map(request => <View key={request.id} style={styles.card}><Text style={styles.help}>PR-{request.id.slice(0,8).toUpperCase()}</Text><Text style={styles.heading}>{privacyTypeLabel(request.request_type)}</Text><Text style={styles.link}>{privacyStatusLabel(request.status)}</Text><Text style={styles.help}>{request.details}</Text><Text style={styles.help}>Submitted: {dateLabel(request.created_at)}{ '\n' }Updated: {dateLabel(request.updated_at)}{request.resolved_at ? `\nResolved: ${dateLabel(request.resolved_at)}` : ''}</Text>{request.review_note ? <><Text style={styles.heading}>Review note</Text><Text style={styles.help}>{request.review_note}</Text></> : null}</View>)}
  <Pressable accessibilityRole="link" onPress={() => void openWeb()} style={styles.option}><Text style={styles.link}>Privacy requests · opens website ↗</Text></Pressable>
 </ScrollView><MobileNav /></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.white }, screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 }, brand: { alignItems: 'center' }, content: { gap: 14, paddingBottom: 16 }, title: { fontSize: 27, fontWeight: '900', color: theme.colors.ink }, heading: { fontSize: 18, fontWeight: '800', color: theme.colors.ink }, help: { fontSize: 13, lineHeight: 20, color: theme.colors.inkMuted }, link: { minHeight: 44, paddingVertical: 12, color: theme.colors.primaryStrong, fontWeight: '800' }, card: { gap: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16 }, option: { paddingHorizontal: 12, minHeight: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, marginBottom: 8 }, selected: { backgroundColor: theme.colors.secondary, borderColor: theme.colors.primary }, input: { minHeight: 140, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, fontSize: 16, color: theme.colors.ink }, button: { minHeight: 48, backgroundColor: theme.colors.primary, borderRadius: 12, justifyContent: 'center', alignItems: 'center', padding: 12 }, buttonText: { color: theme.colors.white, fontWeight: '800' }, disabled: { opacity: 0.6 }, error: { color: theme.colors.danger }, success: { color: theme.colors.success } });
