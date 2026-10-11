import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';
import { profileDestination } from '../lib/profile-model';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';
import { NativeIcon } from './NativeIcon';
import { ProfileAvatar } from './ProfileAvatar';

const items = [
  { href: '/home', label: 'Home', icon: 'home', auth: true },
  { href: '/explore', label: 'Explore', icon: 'search', auth: false },
  { href: '/request-service', label: 'Request', icon: 'plus', auth: true },
  { href: '/bookings', label: 'Bookings', icon: 'calendar', auth: true },
  { href: '/account', label: 'Profile', icon: 'person', auth: true },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const workspace = useWorkspace();
  const profile = /^\/provider(?:-|\/|$)/.test(pathname)
    ? workspace.profiles.find((item) => item.scope !== 'customer')
    : workspace.profiles.find((item) => item.scope === workspace.selectedScope);
  const provider = profile && profile.scope !== 'customer';
  return <View style={styles.shell}><View style={styles.nav}>
    {items.map((item) => {
      if (item.auth && auth.status !== 'signedIn') return null;
      const destination = item.href === '/account' ? profileDestination(profile?.scope ?? workspace.selectedScope)
        : item.href === '/bookings' && provider ? '/provider-bookings' : item.href;
      const active = pathname === destination
        || (item.href === '/account' && pathname === '/settings')
        || (item.href === '/bookings' && (pathname.startsWith('/bookings/') || pathname.startsWith('/provider-bookings/')))
        || (item.href === '/request-service' && pathname.startsWith('/requirements'));
      const create = item.href === '/request-service';
      const color = create ? theme.colors.white : active ? theme.colors.primaryStrong : theme.colors.inkMuted;
      return <Pressable key={item.href} accessibilityRole="button" accessibilityLabel={create ? 'Post a requirement as Customer' : item.label} accessibilityState={{ selected: active }} onPress={() => {
        if (create) workspace.select('customer');
        router.navigate(destination);
      }} style={({ pressed }) => [styles.link, active && styles.activeLink, pressed && styles.pressed]}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.iconWrap, create && styles.createIcon]}>
          {item.href === '/account' && profile?.media?.avatar_url ? <ProfileAvatar name={profile.name} url={profile.media.avatar_url} size={28} /> : <NativeIcon name={item.icon} color={color} size={create ? 28 : 24} />}
        </View>
        <Text numberOfLines={1} style={[styles.label, active && styles.activeText]}>{item.label}</Text>
      </Pressable>;
    })}
    {auth.status === 'signedOut' ? <Pressable accessibilityRole="button" onPress={() => router.navigate('/login')} style={styles.link}><View style={styles.iconWrap}><NativeIcon name="person" /></View><Text style={styles.label}>Sign in</Text></Pressable> : null}
  </View></View>;
}
const styles = StyleSheet.create({
  shell: { alignSelf: 'stretch', borderTopWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingTop: 4 },
  nav: { flexDirection: 'row', width: '100%', alignItems: 'stretch' },
  link: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: theme.radii.md, paddingVertical: 4 },
  activeLink: { backgroundColor: theme.colors.secondary },
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  createIcon: { borderRadius: 20, backgroundColor: theme.colors.primary },
  label: { width: '100%', textAlign: 'center', paddingHorizontal: 2, fontSize: 10, fontWeight: '800', color: theme.colors.inkMuted },
  activeText: { color: theme.colors.primaryStrong },
  pressed: { opacity: 0.65 },
});
