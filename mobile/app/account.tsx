import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileNav } from '../components/MobileNav';
import { useAuth } from '../providers/AuthProvider';

export default function AccountScreen() {
  const auth = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading account…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (auth.status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  const providerAccess = auth.identity.roles.includes('professional') || auth.identity.roles.includes('business_owner');

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError('');
    try {
      await auth.signOut();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign out.');
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Text style={styles.title}>Your TakeItEsee account</Text>
          <Text style={styles.description}>
            This native workspace uses the server-validated identity from Native Contract v1.
          </Text>
        </View>

        <View style={styles.quickRow}>
          <Link href="/notifications" asChild>
            <Pressable style={styles.quickCard}>
              <Text style={styles.quickEyebrow}>ATTENTION</Text>
              <Text style={styles.quickTitle}>Notifications</Text>
              <Text style={styles.quickText}>Booking, proposal and message updates.</Text>
              <Text style={styles.quickOpen}>Open →</Text>
            </Pressable>
          </Link>
          <Link href="/messages" asChild>
            <Pressable style={styles.quickCard}>
              <Text style={styles.quickEyebrow}>CONVERSATIONS</Text>
              <Text style={styles.quickTitle}>Messages</Text>
              <Text style={styles.quickText}>Customer and Provider workspace threads.</Text>
              <Text style={styles.quickOpen}>Open →</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.quickRow}>
          <Link href="/reviews" asChild>
            <Pressable style={styles.quickCard}>
              <Text style={styles.quickEyebrow}>FEEDBACK</Text>
              <Text style={styles.quickTitle}>My reviews</Text>
              <Text style={styles.quickText}>Read your published service feedback and Provider responses.</Text>
              <Text style={styles.quickOpen}>Open →</Text>
            </Pressable>
          </Link>
          {providerAccess ? (
            <Link href="/provider-reviews" asChild>
              <Pressable style={styles.quickCard}>
                <Text style={styles.quickEyebrow}>PROVIDER</Text>
                <Text style={styles.quickTitle}>Provider reviews</Text>
                <Text style={styles.quickText}>Read Customer ratings and your existing response history.</Text>
                <Text style={styles.quickOpen}>Open →</Text>
              </Pressable>
            </Link>
          ) : <View style={styles.quickSpacer} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Identity</Text>
          <Text style={styles.value}>User ID</Text>
          <Text style={styles.detail}>{auth.identity.userId}</Text>
          <Text style={styles.value}>Server roles</Text>
          <Text style={styles.detail}>
            {auth.identity.roles.length ? auth.identity.roles.join(', ') : 'No roles returned'}
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={signingOut}
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
        </Pressable>

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
  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, minHeight: 132, gap: 5, padding: 14, borderRadius: 15, backgroundColor: '#fff' },
  quickSpacer: { flex: 1 },
  quickEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#77778a' },
  quickTitle: { fontSize: 16, fontWeight: '800', color: '#171721' },
  quickText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#666678' },
  quickOpen: { fontSize: 12, fontWeight: '800', color: '#30304a' },
  card: { gap: 8, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#171721' },
  value: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#77778a' },
  detail: { fontSize: 14, lineHeight: 20, color: '#444454' },
  muted: { fontSize: 13, color: '#77778a' },
  error: { fontSize: 13, lineHeight: 19, color: '#a12626' },
  signOutButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#e9e9f1',
  },
  signOutText: { fontSize: 14, fontWeight: '800', color: '#30304a' },
  buttonPressed: { opacity: 0.78 },
  spacer: { flex: 1 },
});
