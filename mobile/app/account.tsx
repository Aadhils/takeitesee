import { Redirect } from 'expo-router';
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
            This native shell uses the server-validated identity from Native Contract v1.
          </Text>
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mobile account roadmap</Text>
          <Text style={styles.detail}>Requirements, bookings, notifications and messages will connect here in the next customer slices.</Text>
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
