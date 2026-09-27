import { Link, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

const items = [
  { href: '/home', label: 'Home', auth: true },
  { href: '/explore', label: 'Explore', auth: false },
  { href: '/requirements', label: 'Requests', auth: true },
  { href: '/account', label: 'Account', auth: true },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const auth = useAuth();
  const isProvider =
    auth.status === 'signedIn' &&
    (auth.identity.roles.includes('professional') || auth.identity.roles.includes('business_owner'));

  const isActive = (href: string) =>
    pathname === href || (href === '/requirements' && pathname.startsWith('/requirements/'));

  return (
    <View style={styles.shell}>
      <View style={styles.nav}>
        {items.map((item) => {
          if (item.auth && auth.status !== 'signedIn') return null;
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} style={[styles.link, active && styles.activeLink]}>
              <Text style={[styles.label, active && styles.activeLabel]}>{item.label}</Text>
            </Link>
          );
        })}
        {isProvider ? (
          <Link href="/provider" style={[styles.link, pathname === '/provider' && styles.activeLink]}>
            <Text style={[styles.label, pathname === '/provider' && styles.activeLabel]}>Provider</Text>
          </Link>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.surface,
    padding: 4,
  },
  nav: {
    flexDirection: 'row',
    gap: 4,
  },
  link: {
    flex: 1,
    minHeight: 44,
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRadius: theme.radii.md,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  activeLink: {
    backgroundColor: theme.colors.primary,
  },
  label: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.inkMuted,
  },
  activeLabel: {
    color: theme.colors.white,
  },
});
