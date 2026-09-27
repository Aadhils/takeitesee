import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { cardShadow, theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

export default function HomeScreen() {
  const auth = useAuth();
  const router = useRouter();

  if (auth.status === 'signedOut') return <Redirect href="/login" />;

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.statusText}>Loading your account…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <BrandLogo />
          <Text style={styles.title}>Your marketplace</Text>
          <Text style={styles.description}>
            Find services, manage bookings and keep up with your requests in one place.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/explore')}
          style={({ pressed }) => [styles.primaryCard, pressed && styles.pressed]}
        >
          <View style={styles.primaryCopy}>
            <Text style={styles.primaryEyebrow}>DISCOVER</Text>
            <Text style={styles.primaryTitle}>Explore services</Text>
            <Text style={styles.primaryText}>Find Professionals and Businesses for the service you need.</Text>
          </View>
          <Text style={styles.primaryArrow}>→</Text>
        </Pressable>

        <View style={styles.quickRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/bookings')}
            style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
          >
            <Text style={styles.quickEyebrow}>BOOKINGS</Text>
            <Text style={styles.quickTitle}>My bookings</Text>
            <Text style={styles.quickText}>Review upcoming and completed service bookings.</Text>
            <Text style={styles.quickOpen}>Open →</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/requirements')}
            style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
          >
            <Text style={styles.quickEyebrow}>REQUESTS</Text>
            <Text style={styles.quickTitle}>Post a requirement</Text>
            <Text style={styles.quickText}>Describe what you need and receive proposals from matching Providers.</Text>
            <Text style={styles.quickOpen}>Post →</Text>
          </Pressable>
        </View>

        <View style={styles.spacer} />
        <MobileNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.canvas },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10, gap: 16 },
  header: { gap: 8 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -0.7, color: theme.colors.ink },
  description: { fontSize: 16, lineHeight: 24, color: theme.colors.inkMuted },
  primaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 19,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.primary,
    ...cardShadow,
  },
  primaryCopy: { flex: 1, gap: 4 },
  primaryEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: '#DDD8FF' },
  primaryTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.white },
  primaryText: { fontSize: 14, lineHeight: 20, color: '#F0EDFF' },
  primaryArrow: { fontSize: 24, fontWeight: '900', color: theme.colors.white },
  quickRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  quickCard: {
    flex: 1,
    minWidth: 0,
    gap: 7,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    ...cardShadow,
  },
  quickEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: theme.colors.primary },
  quickTitle: { fontSize: 16, fontWeight: '900', color: theme.colors.ink },
  quickText: { fontSize: 12, lineHeight: 18, color: theme.colors.inkMuted },
  quickOpen: { marginTop: 'auto', paddingTop: 4, fontSize: 12, fontWeight: '900', color: theme.colors.primaryStrong },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  statusText: { fontSize: 15, color: theme.colors.inkMuted },
  spacer: { flex: 1 },
});
