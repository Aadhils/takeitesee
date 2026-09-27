import { Link, Redirect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { cardShadow, theme } from '../lib/theme';
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
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <BrandLogo compact />
            <Text style={styles.eyebrow}>ACCOUNT</Text>
            <Text style={styles.title}>Your TakeItEsee account</Text>
            <Text style={styles.description}>
              Manage your bookings, messages, notifications and reviews from one place.
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
                <Text style={styles.quickText}>Your service conversations in one place.</Text>
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
            <Text style={styles.cardTitle}>Your access</Text>
            <Text style={styles.value}>Customer</Text>
            <Text style={styles.detail}>Book services, post requirements and manage your marketplace activity.</Text>
            {providerAccess ? (
              <>
                <Text style={styles.value}>Provider</Text>
                <Text style={styles.detail}>Provider tools are available for your Professional or Business profile.</Text>
              </>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Privacy & account</Text>
            <Text style={styles.detail}>
              Read how TakeItEsee handles your information or start an account-deletion request.
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL('https://www.takeitesee.com/privacy')}
              style={({ pressed }) => [styles.accountLink, pressed && styles.buttonPressed]}
            >
              <Text style={styles.accountLinkText}>Privacy Policy →</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL('https://www.takeitesee.com/account/privacy')}
              style={({ pressed }) => [styles.accountLink, pressed && styles.buttonPressed]}
            >
              <Text style={styles.accountLinkText}>Request account deletion →</Text>
            </Pressable>
            <Text style={styles.privacyNote}>
              Deletion requests are reviewed through TakeItEsee's privacy-request workflow. Some records may be retained where required for security, fraud prevention, disputes, audit integrity, or legal obligations.
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
        </ScrollView>
        <MobileNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.canvas },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 },
  content: { gap: 14, paddingBottom: 8 },
  header: { gap: 6 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: theme.colors.primary },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.4, color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, minHeight: 128, gap: 6, padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, ...cardShadow },
  quickSpacer: { flex: 1 },
  quickEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: theme.colors.primary },
  quickTitle: { fontSize: 16, fontWeight: '900', color: theme.colors.ink },
  quickText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.colors.inkMuted },
  quickOpen: { fontSize: 12, fontWeight: '900', color: theme.colors.primaryStrong },
  card: { gap: 8, padding: 18, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, ...cardShadow },
  cardTitle: { fontSize: 17, fontWeight: '900', color: theme.colors.ink },
  value: { marginTop: 4, fontSize: 12, fontWeight: '900', color: theme.colors.primary },
  detail: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  muted: { fontSize: 13, color: theme.colors.inkMuted },
  accountLink: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  accountLinkText: { fontSize: 14, fontWeight: '900', color: theme.colors.primaryStrong },
  privacyNote: { fontSize: 12, lineHeight: 18, color: theme.colors.inkMuted },
  error: { fontSize: 13, lineHeight: 19, color: '#a12626' },
  signOutButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.secondary,
  },
  signOutText: { fontSize: 14, fontWeight: '900', color: theme.colors.primaryStrong },
  buttonPressed: { opacity: 0.78 },
});
