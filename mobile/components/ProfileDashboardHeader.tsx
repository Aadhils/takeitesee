import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { cardShadow, theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

type Scope = 'customer' | 'professional' | 'business';
type Workspace = { id: Scope; label: string; display_name: string; verified?: boolean };
type Media = { scope: Scope; avatar_url: string | null; banner_url: string | null };
type Dashboard = { userId: string; context: 'customer' | 'provider'; workspace: Workspace; workspaces: Workspace[]; media: Media };

export function ProfileDashboardHeader({ context }: { context: 'customer' | 'provider' }) {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.identity.userId : null;
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [failedAvatar, setFailedAvatar] = useState(false);
  const [failedBanner, setFailedBanner] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setDashboard(null);
    setLoading(true);
    setError('');
    setFailedAvatar(false);
    setFailedBanner(false);
    void (async () => {
      try {
        if (!userId) throw new Error('Please sign in to view your profile.');
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session || data.session.user.id !== userId) throw new Error('Please sign in again to view your profile.');
        const accessToken = data.session.access_token;
        const [profiles, media] = await Promise.all([
          apiFetch<{ workspaces: Workspace[] }>('/api/account/workspaces', { accessToken }),
          apiFetch<{ identity: Media }>(`/api/identity-media?context=${context}`, { accessToken }),
        ]);
        const workspaces = profiles.workspaces.filter((profile) => ['customer', 'professional', 'business'].includes(profile.id));
        const providers = workspaces.filter((profile) => profile.id !== 'customer');
        if (providers.length > 1) throw new Error('Your Provider identity needs review. Please open account settings on the web.');
        const workspace = workspaces.find((profile) => profile.id === media.identity.scope);
        if (!workspace || (context === 'customer' && workspace.id !== 'customer') || (context === 'provider' && workspace.id === 'customer')) throw new Error('This profile is unavailable.');
        if (active) setDashboard({ userId, context, workspace, workspaces, media: media.identity });
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Your profile could not load.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [context, userId, retry]));

  if (loading) return <View style={styles.status}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.muted}>Loading your profile…</Text></View>;
  if (dashboard && (dashboard.userId !== userId || dashboard.context !== context)) return <View style={styles.status}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.muted}>Loading your profile…</Text></View>;
  if (!dashboard) return <View style={styles.status}>
    <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
    <Pressable accessibilityRole="button" onPress={() => setRetry((value) => value + 1)} style={styles.retry}><Text style={styles.actionText}>Retry profile</Text></Pressable>
  </View>;

  const { workspace, workspaces, media } = dashboard;
  const initials = workspace.display_name.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
  return <View style={styles.shell}>
    <View style={[styles.banner, workspace.id === 'business' && styles.businessBanner]}>
      {media.banner_url && !failedBanner ? <Image source={{ uri: media.banner_url }} resizeMode="cover" style={styles.bannerImage} onError={() => setFailedBanner(true)} /> : <><View style={styles.bannerAccent} /><Text style={styles.bannerLabel}>{workspace.label} workspace</Text></>}
    </View>
    <View style={styles.content}>
      <View style={styles.avatar}>
        {media.avatar_url && !failedAvatar ? <Image accessibilityLabel={`${workspace.display_name} profile picture`} source={{ uri: media.avatar_url }} style={styles.avatarImage} onError={() => setFailedAvatar(true)} /> : <Text style={styles.initials}>{initials}</Text>}
      </View>
      <Text style={styles.name}>{workspace.display_name}</Text>
      <View style={styles.badges}><Text style={styles.scope}>{workspace.label} identity</Text>{workspace.verified ? <Text style={styles.verified}>Verified</Text> : null}</View>
      <Text style={styles.muted}>{context === 'customer' ? 'Your bookings, requirements and conversations.' : 'Your services, leads and booking workspace.'}</Text>
      <View style={styles.switcher}>
        {workspaces.map((profile) => <Link key={profile.id} href={profile.id === 'customer' ? '/account' : '/provider'} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${profile.label} profile`} accessibilityState={{ selected: profile.id === workspace.id }} android_ripple={{ color: '#E8E2FF', foreground: true }} style={[styles.profileLink, profile.id === workspace.id && styles.selected]}>
            <Text style={styles.actionText}>{profile.label}</Text>
            <Text numberOfLines={1} style={styles.profileName}>{profile.display_name}</Text>
          </Pressable>
        </Link>)}
      </View>
      <Text style={styles.note}>Profile photos and banners sync with your web profile. Manage them from your web dashboard.</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  shell: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.white, overflow: 'hidden', ...cardShadow },
  banner: { height: 130, backgroundColor: theme.colors.primaryStrong, overflow: 'hidden', justifyContent: 'flex-end', padding: 18 },
  businessBanner: { backgroundColor: theme.colors.ink },
  bannerImage: { ...StyleSheet.absoluteFillObject },
  bannerAccent: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: theme.colors.primary, right: -70, top: -110 },
  bannerLabel: { alignSelf: 'flex-end', color: theme.colors.white, fontSize: 12, fontWeight: '800' },
  content: { padding: 16, paddingTop: 0, gap: 8 },
  avatar: { width: 82, height: 82, borderRadius: 41, marginTop: -36, borderWidth: 4, borderColor: theme.colors.white, backgroundColor: theme.colors.secondary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  initials: { fontSize: 28, fontWeight: '900', color: theme.colors.primaryStrong },
  name: { fontSize: 24, lineHeight: 30, fontWeight: '900', color: theme.colors.ink },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scope: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: theme.colors.secondary, color: theme.colors.primaryStrong, fontSize: 11, fontWeight: '800' },
  verified: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: '#E8F5EC', color: '#285C33', fontSize: 11, fontWeight: '800' },
  muted: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  profileLink: { flexGrow: 1, flexBasis: 120, minWidth: 0, minHeight: 58, padding: 10, gap: 4, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border },
  selected: { backgroundColor: theme.colors.secondary, borderColor: theme.colors.primary },
  actionText: { color: theme.colors.primaryStrong, fontWeight: '800', fontSize: 12 },
  profileName: { color: theme.colors.inkMuted, fontSize: 12 },
  note: { color: theme.colors.inkMuted, fontSize: 11, lineHeight: 16 },
  status: { padding: 16, gap: 10, borderRadius: theme.radii.md, backgroundColor: theme.colors.secondary },
  error: { color: '#8B3535', fontSize: 13, lineHeight: 19 },
  retry: { minHeight: 44, justifyContent: 'center' },
});
