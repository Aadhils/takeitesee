import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { profileDestination, type ProfileScope } from '../lib/profile-model';
import { theme } from '../lib/theme';
import { useWorkspace } from '../providers/WorkspaceProvider';
import { NativeIcon } from './NativeIcon';
import { ProfileAvatar } from './ProfileAvatar';

export function ProfileSwitcher({ scope, disabled = false, compact = false }: { scope?: ProfileScope; disabled?: boolean; compact?: boolean }) {
  const workspace = useWorkspace();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const activeScope = scope ?? workspace.selectedScope;
  const current = workspace.profiles.find((profile) => profile.scope === activeScope);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Switch profile" accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => { setOpen(true); void workspace.refresh(); }} style={({ pressed }) => [compact ? styles.compactTrigger : styles.trigger, pressed && styles.pressed, disabled && styles.disabled]}>
      {compact ? <ProfileAvatar name={current?.name ?? 'My profile'} url={current?.media?.avatar_url} size={32} /> : <Text style={styles.triggerText}>Switch profile</Text>}
      <NativeIcon name="chevron" color={theme.colors.primaryStrong} size={18} />
    </Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close profile switcher" onPress={() => setOpen(false)} style={styles.backdrop} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Switch profile</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpen(false)} style={styles.close}><NativeIcon name="close" /></Pressable></View>
          <Text style={styles.description}>Choose how you use TakeItEsee.</Text>
          <ScrollView contentContainerStyle={styles.list}>
            {workspace.profiles.map((profile) => {
              const selected = profile.scope === activeScope;
              return <Pressable key={profile.scope} accessibilityRole="button" accessibilityLabel={`${profile.name}, ${profile.label}`} accessibilityState={{ selected }} onPress={() => {
                if (!workspace.select(profile.scope)) return;
                setOpen(false);
                router.replace(profileDestination(profile.scope));
              }} style={({ pressed }) => [styles.profileRow, selected && styles.selectedRow, pressed && styles.pressed]}>
                <ProfileAvatar name={profile.name} url={profile.media?.avatar_url} size={52} />
                <View style={styles.profileCopy}><Text style={styles.name}>{profile.name}</Text><Text style={styles.role}>{profile.label}{profile.verified ? ' · Verified' : ''}</Text></View>
                {selected ? <View style={styles.check}><NativeIcon name="check" color={theme.colors.white} size={18} /></View> : null}
              </Pressable>;
            })}
            {workspace.loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
            {workspace.error ? <><Text accessibilityRole="alert" style={styles.error}>{workspace.error}</Text><Pressable accessibilityRole="button" onPress={() => void workspace.refresh()} style={styles.retry}><Text style={styles.triggerText}>Retry profiles</Text></Pressable></> : null}
          </ScrollView>
          <Text style={styles.note}>Your Customer profile and one final Professional or Business identity share the same login.</Text>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  trigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, borderRadius: theme.radii.md, backgroundColor: theme.colors.secondary },
  compactTrigger: { minHeight: 44, minWidth: 48, flexDirection: 'row', alignItems: 'center', gap: 2 },
  triggerText: { color: theme.colors.primaryStrong, fontWeight: '800', fontSize: 13 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,26,52,0.42)' },
  sheet: { maxHeight: '80%', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 12, backgroundColor: theme.colors.white },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: theme.colors.border },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '900', color: theme.colors.ink },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  description: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  list: { gap: 10, paddingVertical: 4 },
  profileRow: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border },
  selectedRow: { borderColor: theme.colors.primary, backgroundColor: theme.colors.secondary },
  profileCopy: { flex: 1, minWidth: 0, gap: 5 },
  name: { fontSize: 17, fontWeight: '800', color: theme.colors.ink },
  role: { fontSize: 12, lineHeight: 17, color: theme.colors.inkMuted },
  check: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 12, lineHeight: 18, color: theme.colors.inkMuted },
  retry: { minHeight: 44, justifyContent: 'center' },
  error: { fontSize: 13, lineHeight: 19, color: theme.colors.danger },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
