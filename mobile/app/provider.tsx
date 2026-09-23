import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileNav } from '../components/MobileNav';
import { useAuth } from '../providers/AuthProvider';

export default function ProviderScreen() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.muted}>Checking provider access…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (auth.status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  const isProfessional = auth.identity.roles.includes('professional');
  const isBusiness = auth.identity.roles.includes('business_owner');

  if (!isProfessional && !isBusiness) {
    return <Redirect href="/home" />;
  }

  const providerType = isProfessional ? 'Professional' : 'Business';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>PROVIDER</Text>
          <Text style={styles.title}>{providerType} workspace</Text>
          <Text style={styles.description}>
            Provider access is visible because the server returned the matching provider role for this account.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Provider Phase 1</Text>
          <Text style={styles.detail}>
            Leads, proposals, bookings and reviews will connect to the frozen Provider Native Contract routes in focused slices.
          </Text>
        </View>

        <View style={styles.spacer} />
        <MobileNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10, gap: 14 },
  header: { gap: 6 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#666678' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#171721' },
  description: { fontSize: 14, lineHeight: 20, color: '#666678' },
  card: { gap: 8, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#171721' },
  detail: { fontSize: 14, lineHeight: 20, color: '#444454' },
  muted: { fontSize: 13, color: '#77778a' },
  spacer: { flex: 1 },
});
