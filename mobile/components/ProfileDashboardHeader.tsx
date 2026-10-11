import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { removeIdentityMedia, uploadIdentityMedia } from '../lib/identity-media';
import { inspectIdentityImage, MAX_IDENTITY_IMAGE_BYTES, type MediaKind } from '../lib/profile-model';
import { cardShadow, theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';
import { NativeIcon } from './NativeIcon';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileSwitcher } from './ProfileSwitcher';

type PhotoDraft = { ownerKey: string; kind: MediaKind; uri: string; buffer: ArrayBuffer };

export function ProfileDashboardHeader({ context }: { context: 'customer' | 'provider' }) {
  const auth = useAuth();
  const workspace = useWorkspace();
  const insets = useSafeAreaInsets();
  const userId = auth.status === 'signedIn' ? auth.identity.userId : null;
  const profile = workspace.profiles.find((item) => context === 'customer' ? item.scope === 'customer' : item.scope !== 'customer');
  const [draft, setDraft] = useState<PhotoDraft | null>(null);
  const [working, setWorking] = useState<MediaKind | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [failedBanner, setFailedBanner] = useState<string | null>(null);
  const busy = useRef(false);
  const active = useRef(true);
  const scope = profile?.scope;
  const ownerKey = `${userId ?? ''}:${scope ?? ''}`;
  const currentOwnerKey = useRef(ownerKey);
  currentOwnerKey.current = ownerKey;
  const { refresh, select, updateMedia } = workspace;

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => { if (scope) select(scope); }, [scope, select]);
  useEffect(() => { setDraft(null); setWorking(null); busy.current = false; setError(''); setNotice(''); }, [userId, scope]);

  const choosePhoto = async (kind: MediaKind) => {
    if (!profile?.media || !userId || busy.current || draft) return;
    const operationKey = ownerKey;
    const current = () => active.current && currentOwnerKey.current === operationKey;
    busy.current = true;
    setWorking(kind); setError(''); setNotice('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: false, allowsEditing: true,
        aspect: kind === 'avatar' ? [1, 1] : [3, 1], quality: 0.85, exif: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_IDENTITY_IMAGE_BYTES) throw new Error('Choose a photo up to 6 MB.');
      const response = await fetch(asset.uri);
      const buffer = await response.arrayBuffer();
      inspectIdentityImage(buffer);
      if (current()) setDraft({ ownerKey: operationKey, kind, uri: asset.uri, buffer });
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : 'Your photo could not open. Please try again.');
    } finally {
      if (current()) { busy.current = false; setWorking(null); }
    }
  };

  const savePhoto = async () => {
    if (!draft || draft.ownerKey !== ownerKey || !profile?.media || !userId || busy.current) return;
    const operationKey = ownerKey;
    const current = () => active.current && currentOwnerKey.current === operationKey;
    busy.current = true;
    setWorking(draft.kind); setError('');
    try {
      const media = await uploadIdentityMedia(userId, profile.scope, draft.kind, draft.buffer);
      if (current()) {
        updateMedia(profile.scope, media);
        setDraft(null);
        setNotice(draft.kind === 'avatar' ? 'Profile photo updated.' : 'Cover photo updated.');
      }
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : 'Your photo could not save. Please retry.');
    } finally {
      if (current()) { busy.current = false; setWorking(null); }
    }
  };

  const removePhoto = (kind: MediaKind) => {
    if (!profile?.media || !userId || busy.current) return;
    const operationKey = ownerKey;
    const current = () => active.current && currentOwnerKey.current === operationKey;
    Alert.alert(kind === 'avatar' ? 'Remove profile photo?' : 'Remove cover photo?', 'This removes the photo from this identity on both the app and web.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        if (busy.current || !current()) return;
        busy.current = true;
        setWorking(kind); setError(''); setNotice('');
        void removeIdentityMedia(userId, profile.scope, kind).then((media) => {
          if (current()) { updateMedia(profile.scope, media); setNotice('Photo removed.'); }
        }).catch((cause) => {
          if (current()) setError(cause instanceof Error ? cause.message : 'Your photo could not be removed.');
        }).finally(() => { if (current()) { busy.current = false; setWorking(null); } });
      } },
    ]);
  };

  if (!profile) return <View style={styles.status}>
    {workspace.loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
    <Text style={styles.muted}>{workspace.error || (workspace.loading ? 'Loading your profile…' : 'Your profile could not load.')}</Text>
    <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}><Text style={styles.actionText}>Retry profile</Text></Pressable>
  </View>;

  const media = profile.media;
  const busyUI = Boolean(working);
  return <View style={styles.shell}>
    <View style={[styles.banner, profile.scope === 'business' && styles.businessBanner]}>
      {media?.banner_url && failedBanner !== media.banner_url ? <Image source={{ uri: media.banner_url }} resizeMode="cover" style={styles.bannerImage} onError={() => setFailedBanner(media.banner_url)} /> : <View style={styles.bannerAccent} />}
      <Pressable accessibilityRole="button" accessibilityLabel={media?.has_banner ? 'Change cover photo' : 'Add cover photo'} accessibilityState={{ disabled: busyUI || !media }} disabled={busyUI || !media} onPress={() => void choosePhoto('banner')} style={({ pressed }) => [styles.coverEdit, pressed && styles.pressed]}>
        <NativeIcon name="camera" size={18} color={theme.colors.ink} /><Text style={styles.coverText}>{working === 'banner' ? 'Working…' : media?.has_banner ? 'Edit cover' : 'Add cover'}</Text>
      </Pressable>
    </View>
    <View style={styles.content}>
      <View style={styles.avatarRow}>
        <View style={styles.avatarWrap}>
          <ProfileAvatar name={profile.name} url={media?.avatar_url} size={80} />
          <Pressable accessibilityRole="button" accessibilityLabel={media?.has_avatar ? 'Change profile photo' : 'Add profile photo'} accessibilityState={{ disabled: busyUI || !media }} disabled={busyUI || !media} onPress={() => void choosePhoto('avatar')} style={({ pressed }) => [styles.avatarEdit, pressed && styles.pressed]}><NativeIcon name="camera" size={18} color={theme.colors.primaryStrong} /></Pressable>
        </View>
        <ProfileSwitcher scope={profile.scope} disabled={busyUI || Boolean(draft)} />
      </View>
      <Text style={styles.name}>{profile.name}</Text>
      <View style={styles.badges}><Text style={styles.scope}>{profile.label} identity</Text>{profile.verified ? <Text style={styles.verified}>Verified</Text> : null}</View>
      <Text style={styles.muted}>{context === 'customer' ? 'Your bookings, requirements and conversations.' : 'Your services, leads and booking workspace.'}</Text>
      {media?.has_avatar || media?.has_banner ? <View style={styles.removeRow}>
        {media.has_avatar ? <Pressable accessibilityRole="button" disabled={busyUI} onPress={() => removePhoto('avatar')} style={styles.retry}><Text style={styles.removeText}>Remove profile photo</Text></Pressable> : null}
        {media.has_banner ? <Pressable accessibilityRole="button" disabled={busyUI} onPress={() => removePhoto('banner')} style={styles.retry}><Text style={styles.removeText}>Remove cover</Text></Pressable> : null}
      </View> : null}
      {profile.mediaError ? <><Text accessibilityRole="alert" style={styles.error}>{profile.mediaError}</Text><Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}><Text style={styles.actionText}>Retry photos</Text></Pressable></> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.success}>{notice}</Text> : null}
      {error && !draft ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
    <Modal visible={Boolean(draft && draft.ownerKey === ownerKey)} transparent animationType="slide" onRequestClose={() => { if (!busy.current) { setDraft(null); setError(''); } }}>
      <View style={styles.overlay}>
        <View style={styles.backdrop} />
        <View accessibilityViewIsModal style={[styles.previewSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text accessibilityRole="header" style={styles.previewTitle}>{draft?.kind === 'avatar' ? 'Preview profile photo' : 'Preview cover photo'}</Text>
          <ScrollView contentContainerStyle={styles.previewContent}>
            {draft ? <Image source={{ uri: draft.uri }} resizeMode="cover" accessibilityLabel="Selected photo preview" style={draft.kind === 'avatar' ? styles.previewAvatar : styles.previewBanner} /> : null}
            <Text style={styles.muted}>{profile.label} · {profile.name}</Text>
            <Text style={styles.muted}>{profile.scope === 'customer' ? 'Your Customer photo stays private to your account.' : 'This Provider photo is visible on your public marketplace profile.'}</Text>
            <Text style={styles.note}>Use a photo you own or have permission to use. Avoid private documents or other people’s personal information.</Text>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <Pressable accessibilityRole="button" disabled={busyUI} accessibilityState={{ disabled: busyUI, busy: busyUI }} onPress={() => void savePhoto()} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, busyUI && styles.disabled]}>{busyUI ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.saveText}>Save photo</Text>}</Pressable>
          <Pressable accessibilityRole="button" disabled={busyUI} onPress={() => { setDraft(null); setError(''); }} style={styles.cancelButton}><Text style={styles.actionText}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  shell: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.white, overflow: 'hidden', ...cardShadow },
  banner: { width: '100%', aspectRatio: 3, backgroundColor: theme.colors.primaryStrong, overflow: 'hidden', padding: 12, alignItems: 'flex-end', justifyContent: 'flex-start' },
  businessBanner: { backgroundColor: theme.colors.ink },
  bannerImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  bannerAccent: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: theme.colors.primary, right: -70, top: -110 },
  coverEdit: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: theme.colors.white },
  coverText: { fontSize: 12, fontWeight: '800', color: theme.colors.ink },
  content: { padding: 16, paddingTop: 0, gap: 8 },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: -34 },
  avatarWrap: { borderWidth: 4, borderColor: theme.colors.white, borderRadius: 44, backgroundColor: theme.colors.white },
  avatarEdit: { position: 'absolute', bottom: -4, right: -6, width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: theme.colors.white, backgroundColor: theme.colors.secondary, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 24, lineHeight: 30, fontWeight: '900', color: theme.colors.ink },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scope: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: theme.colors.secondary, color: theme.colors.primaryStrong, fontSize: 11, fontWeight: '800' },
  verified: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: '#E8F5EC', color: '#285C33', fontSize: 11, fontWeight: '800' },
  muted: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  removeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  removeText: { fontSize: 11, fontWeight: '700', color: theme.colors.inkMuted },
  actionText: { color: theme.colors.primaryStrong, fontWeight: '800', fontSize: 13 },
  note: { color: theme.colors.inkMuted, fontSize: 11, lineHeight: 17 },
  status: { padding: 16, gap: 10, borderRadius: theme.radii.md, backgroundColor: theme.colors.secondary },
  error: { color: theme.colors.danger, fontSize: 13, lineHeight: 19 },
  success: { color: '#285C33', fontSize: 13, lineHeight: 19 },
  retry: { minHeight: 44, justifyContent: 'center' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,26,52,0.42)' },
  previewSheet: { maxHeight: '85%', padding: 20, gap: 14, backgroundColor: theme.colors.white, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  previewTitle: { fontSize: 22, fontWeight: '900', color: theme.colors.ink },
  previewContent: { gap: 12 },
  previewAvatar: { alignSelf: 'center', width: 160, height: 160, borderRadius: 80 },
  previewBanner: { width: '100%', aspectRatio: 3 },
  saveButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.md, backgroundColor: theme.colors.primary },
  saveText: { color: theme.colors.white, fontSize: 14, fontWeight: '800' },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
});
