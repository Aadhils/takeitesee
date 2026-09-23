import { Link, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

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
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    gap: 5,
    padding: 7,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  link: {
    flex: 1,
    minHeight: 42,
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 5,
  },
  activeLink: {
    backgroundColor: '#30304a',
  },
  label: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#555565',
  },
  activeLabel: {
    color: '#ffffff',
  },
});
