import { Link, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

const items = [
  { href: '/home', label: 'Home', icon: '⌂', auth: true },
  { href: '/explore', label: 'Explore', icon: '⌕', auth: false },
  { href: '/request-service', label: 'Request', icon: '+', auth: true },
  { href: '/bookings', label: 'Bookings', icon: '▤', auth: true },
  { href: '/account', label: 'Account', icon: '○', auth: true },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const auth = useAuth();
  return <View style={styles.shell}><View style={styles.nav}>
    {items.map((item) => {
      if (item.auth && auth.status !== 'signedIn') return null;
      const active = pathname === item.href
        || (item.href === '/bookings' && pathname.startsWith('/bookings/'))
        || (item.href === '/request-service' && pathname.startsWith('/requirements'));
      const create = item.href === '/request-service';
      return <Link key={item.href} href={item.href} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel={create ? 'Post a requirement' : item.label} accessibilityState={{ selected: active }} style={({ pressed }) => [styles.link, active && styles.activeLink, pressed && styles.pressed]}>
          <View style={[styles.iconWrap, create && styles.createIcon]}><Text style={[styles.icon, active && styles.activeText, create && styles.createText]}>{item.icon}</Text></View>
          <Text numberOfLines={1} style={[styles.label, active && styles.activeText]}>{item.label}</Text>
        </Pressable>
      </Link>;
    })}
    {auth.status === 'signedOut' ? <Link href="/login" asChild><Pressable accessibilityRole="button" style={styles.link}><Text style={styles.icon}>○</Text><Text style={styles.label}>Sign in</Text></Pressable></Link> : null}
  </View></View>;
}
const styles = StyleSheet.create({
  shell: { borderTopWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingTop: 6 },
  nav: { flexDirection: 'row', gap: 2 },
  link: { flex: 1, minWidth: 0, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: theme.radii.md, paddingVertical: 4 },
  activeLink: { backgroundColor: theme.colors.secondary },
  iconWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  createIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.primary, marginTop: -8 },
  icon: { fontSize: 27, lineHeight: 32, color: theme.colors.inkMuted },
  createText: { fontSize: 32, color: theme.colors.white },
  label: { fontSize: 10, fontWeight: '800', color: theme.colors.inkMuted },
  activeText: { color: theme.colors.primaryStrong },
  pressed: { opacity: 0.65 },
});
