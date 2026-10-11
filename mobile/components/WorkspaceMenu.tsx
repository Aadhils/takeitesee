import { type Href, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ProfileScope } from '../lib/profile-model';
import { theme } from '../lib/theme';
import { workspaceMenu, workspaceWebUrl, type MenuItem } from '../lib/workspace-menu';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';
import { NativeIcon } from './NativeIcon';

export function WorkspaceMenu({ context }: { context: 'customer' | 'provider' }) {
  const auth = useAuth();
  const workspace = useWorkspace();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openOwner, setOpenOwner] = useState('');
  const [error, setError] = useState('');
  const profile = workspace.profiles.find((item) => context === 'provider' ? item.scope !== 'customer' : item.scope === 'customer');
  const scope: ProfileScope | null = profile?.scope ?? (context === 'customer' ? 'customer' : null);
  const userId = auth.status === 'signedIn' ? auth.identity.userId : '';
  const visible = !!userId && openOwner === userId && !!scope;
  const setOpen = (value: boolean) => setOpenOwner(value ? userId : '');
  const navigate = async (item: MenuItem) => {
    setError('');
    if (item.web) {
      try { await Linking.openURL(workspaceWebUrl(item.path)); setOpen(false); }
      catch { setError('This website page could not open. Please try again.'); }
      return;
    }
    if (scope && !workspace.select(scope)) { setError('Your profile could not load. Close the menu and retry.'); return; }
    setOpen(false);
    router.navigate(item.path as Href);
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Open profile menu" accessibilityState={{ expanded: visible, disabled: !scope }} disabled={!scope} onPress={() => { setError(''); setOpen(true); }} style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
      <NativeIcon name="menu" color={theme.colors.primaryStrong} /><Text style={styles.triggerText}>Menu</Text>
    </Pressable>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close profile menu" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.heading}><View style={styles.copy}><Text style={styles.title}>{profile?.label ?? 'Customer'} menu</Text><Text style={styles.muted}>{profile?.name ?? 'Your account'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close profile menu" onPress={() => setOpen(false)} style={styles.close}><NativeIcon name="close" /></Pressable></View>
          <ScrollView contentContainerStyle={styles.content}>
            {scope ? workspaceMenu(scope).map((group) => <View key={group.title} style={styles.group}><Text style={styles.groupTitle}>{group.title}</Text>{group.items.map((item) => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`${item.label}${item.web ? ', opens website' : ''}`} onPress={() => void navigate(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.copy}><Text style={styles.rowTitle}>{item.label}</Text><Text style={styles.muted}>{item.detail}</Text>{item.web ? <Text style={styles.web}>Opens website ↗</Text> : null}</View><Text style={styles.arrow}>›</Text></Pressable>)}</View>) : null}
            <Text style={styles.muted}>Website pages may ask you to sign in with the same account.</Text>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  trigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.colors.secondary },
  triggerText: { color: theme.colors.primaryStrong, fontWeight: '800', fontSize: 13 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#101A3466' },
  sheet: { maxHeight: '85%', backgroundColor: theme.colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: theme.colors.ink, fontSize: 22, fontWeight: '900' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { gap: 18, paddingBottom: 12 },
  group: { gap: 4 },
  groupTitle: { color: theme.colors.primaryStrong, fontSize: 12, fontWeight: '900', paddingVertical: 8 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.colors.border },
  rowTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.ink },
  muted: { color: theme.colors.inkMuted, fontSize: 12, lineHeight: 18 },
  web: { color: theme.colors.primaryStrong, fontSize: 11, fontWeight: '700' },
  arrow: { fontSize: 26, color: theme.colors.primary },
  error: { color: theme.colors.danger, fontSize: 13 },
  pressed: { opacity: 0.75 },
});
