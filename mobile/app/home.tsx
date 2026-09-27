import { Link, Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileNav } from '../components/MobileNav';
import { useAuth } from '../providers/AuthProvider';

export default function HomeScreen() {
  const auth = useAuth();

  if (auth.status === 'signedOut') return <Redirect href="/login" />;

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.statusText}>Loading your account…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TAKEITESEE</Text>
          <Text style={styles.title}>Your marketplace</Text>
          <Text style={styles.description}>
            Find services, manage bookings and keep up with your requests in one place.
          </Text>
        </View>

        <Link href="/explore" asChild>
          <Pressable style={styles.primaryCard}>
            <View style={styles.primaryCopy}>
              <Text style={styles.primaryTitle}>Explore services</Text>
              <Text style={styles.primaryText}>Find Professionals and Businesses for the service you need.</Text>
            </View>
            <Text style={styles.primaryArrow}>→</Text>
          </Pressable>
        </Link>

        <View style={styles.quickRow}>
          <Link href="/bookings" asChild>
            <Pressable style={styles.quickCard}>
              <Text style={styles.quickEyebrow}>BOOKINGS</Text>
              <Text style={styles.quickTitle}>My bookings</Text>
              <Text style={styles.quickText}>Review upcoming and completed service bookings.</Text>
              <Text style={styles.quickOpen}>Open →</Text>
            </Pressable>
          </Link>

          <Link href="/requirements" asChild>
            <Pressable style={styles.quickCard}>
              <Text style={styles.quickEyebrow}>REQUESTS</Text>
              <Text style={styles.quickTitle}>Post a requirement</Text>
              <Text style={styles.quickText}>Describe what you need and receive proposals from matching Providers.</Text>
              <Text style={styles.quickOpen}>Post →</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.spacer} />
        <MobileNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10, gap: 14 },
  header: { gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.6, color: '#5b5b72' },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800', color: '#171721' },
  description: { fontSize: 16, lineHeight: 24, color: '#555565' },
  primaryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 18, backgroundColor: '#30304a' },
  primaryCopy: { flex: 1, gap: 4 },
  primaryTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  primaryText: { fontSize: 14, lineHeight: 20, color: '#dedee9' },
  primaryArrow: { fontSize: 24, fontWeight: '800', color: '#fff' },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, minHeight: 138, gap: 5, padding: 15, borderRadius: 16, backgroundColor: '#fff' },
  quickEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#77778a' },
  quickTitle: { fontSize: 16, fontWeight: '800', color: '#171721' },
  quickText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#666678' },
  quickOpen: { fontSize: 12, fontWeight: '800', color: '#30304a' },
  statusText: { fontSize: 15, color: '#333342' },
  spacer: { flex: 1 },
});
