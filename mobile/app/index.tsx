import { Link, Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

export default function AppEntryScreen() {
  const auth = useAuth();
  if (auth.status === 'signedIn') return <Redirect href="/home" />;
  if (auth.status === 'loading') return <SafeAreaView style={styles.safeArea}><View style={styles.loading}><BrandLogo /><ActivityIndicator color={theme.colors.primary} /><Text style={styles.subtitle}>Getting your marketplace ready…</Text></View></SafeAreaView>;
  if (auth.status === 'signedOut') return <SafeAreaView style={styles.safeArea}>
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brand}><BrandLogo large /></View>
        <View style={styles.copy}>
          <Text style={styles.title}>Find. Book.</Text>
          <Text style={[styles.title, styles.purple]}>Get It Done.</Text>
          <Text style={styles.subtitle}>Discover services, connect with providers, and manage your service journey.</Text>
        </View>
        <View style={styles.actions}>
          <Link href="/explore" asChild><Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryText}>Get Started</Text></Pressable></Link>
          <Link href="/login" asChild><Pressable accessibilityRole="button" style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryText}>Sign In</Text></Pressable></Link>
          <Text style={styles.note}>Explore first. Sign in when you are ready.</Text>
        </View>
      </ScrollView>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.footer}><View style={styles.waveBack} /><View style={styles.waveFront} /></View>
    </View>
  </SafeAreaView>;
  return null;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.surface },
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, paddingTop: 36, paddingBottom: 30, gap: 28 },
  brand: { alignItems: 'center', maxWidth: '100%' },
  copy: { alignItems: 'center', gap: 3, maxWidth: 380 },
  title: { fontSize: 31, lineHeight: 39, fontWeight: '900', textAlign: 'center', color: theme.colors.ink },
  purple: { color: theme.colors.primaryStrong },
  subtitle: { marginTop: 10, fontSize: 15, lineHeight: 23, textAlign: 'center', color: theme.colors.inkMuted },
  actions: { width: '100%', maxWidth: 380, gap: 12 },
  primaryButton: { minHeight: 52, paddingVertical: 14, paddingHorizontal: 16, borderRadius: theme.radii.md, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: theme.colors.white, fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 52, paddingVertical: 14, paddingHorizontal: 16, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: theme.colors.primaryStrong, fontSize: 16, fontWeight: '800' },
  note: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: theme.colors.inkMuted },
  pressed: { opacity: 0.75 },
  footer: { height: 70, overflow: 'hidden', backgroundColor: theme.colors.surface },
  waveBack: { position: 'absolute', top: 10, left: '-15%', width: '130%', height: 140, borderTopLeftRadius: 160, borderTopRightRadius: 100, backgroundColor: theme.colors.accent, transform: [{ rotate: '-6deg' }] },
  waveFront: { position: 'absolute', top: 32, left: '-15%', width: '130%', height: 140, borderTopLeftRadius: 100, borderTopRightRadius: 180, backgroundColor: theme.colors.primary, transform: [{ rotate: '6deg' }] },
});
