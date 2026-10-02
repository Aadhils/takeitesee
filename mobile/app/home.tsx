import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { searchMarketplaceServices, formatMarketplacePrice, type MarketplaceSearchResponse } from '../lib/marketplace';
import { cardShadow, theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

const categoryColors = ['#F2EFFF', '#EAF4FF', '#E9F8F0', '#FFF2E6', '#FFEFF4', '#EDF2FF'];

export default function HomeScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [marketplace, setMarketplace] = useState<MarketplaceSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (auth.status !== 'signedIn') return;
    let active = true;
    setLoading(true);
    setError('');
    searchMarketplaceServices('').then((result) => {
      if (active) setMarketplace(result);
    }).catch(() => {
      if (active) setError('Services could not load. Please try again.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.status, attempt]);

  const search = (text = query) => {
    Keyboard.dismiss();
    router.push({ pathname: '/explore', params: { q: text.trim() } });
  };
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  if (auth.status === 'loading') return <SafeAreaView style={styles.safeArea}><View style={styles.centered}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.description}>Loading your account…</Text></View></SafeAreaView>;
  const providerAccess = auth.identity.roles.includes('professional') || auth.identity.roles.includes('business_owner');

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.logoWrap}><BrandLogo compact /></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}><Text style={styles.headerSymbol}>🔔</Text><Text style={styles.smallLabel}>Updates</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.locationStrip}><Text style={styles.locationText}>Discover services for your next task</Text><Text style={styles.locationMark}>⌖</Text></View>
        <View style={styles.searchRow}>
          <TextInput accessibilityLabel="Search services" value={query} onChangeText={setQuery} onSubmitEditing={() => search()} returnKeyType="search" placeholder="Search for services…" style={styles.searchInput} />
          <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={() => search()} style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}><Text style={styles.searchSymbol}>⌕</Text></Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/explore')} style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
          <View style={styles.heroCircle} />
          <Text style={styles.heroEyebrow}>FIND. BOOK. GET IT DONE.</Text>
          <Text style={styles.heroTitle}>Find the right service\nfor your next task.</Text>
          <Text style={styles.heroBody}>Connect with Professionals and Businesses.</Text>
          <Text style={styles.heroAction}>Explore services →</Text>
        </Pressable>

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Service categories</Text><Pressable accessibilityRole="button" onPress={() => router.push('/explore')} style={styles.textButton}><Text style={styles.textAction}>View all →</Text></Pressable></View>
        {loading ? <View style={styles.status}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.description}>Loading services…</Text></View> : null}
        {error ? <View style={styles.emptyCard}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt((current) => current + 1)} style={styles.textButton}><Text style={styles.textAction}>Try again →</Text></Pressable></View> : null}
        {!loading && !error && marketplace?.categories.length === 0 ? <Text style={styles.description}>Browse Explore to discover available services.</Text> : null}
        {!error ? <View style={styles.categoryGrid}>{marketplace?.categories.slice(0, 8).map((category, index) => <Pressable key={category.slug} accessibilityRole="button" onPress={() => search(category.name)} style={({ pressed }) => [styles.category, pressed && styles.pressed]}><View style={[styles.categoryIcon, { backgroundColor: categoryColors[index % categoryColors.length] }]}><Text style={styles.categoryInitial}>{category.name.slice(0, 1).toUpperCase()}</Text></View><Text numberOfLines={2} style={styles.categoryName}>{category.name}</Text></Pressable>)}</View> : null}

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Your service journey</Text></View>
        <Text style={styles.description}>Find services, manage bookings and keep up with your requests in one place.</Text>
        <View style={styles.quickRow}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/bookings')} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}><Text style={styles.quickSymbol}>▤</Text><Text style={styles.quickTitle}>My bookings</Text><Text style={styles.description}>Keep track of your services →</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/request-service')} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}><Text style={styles.quickSymbol}>＋</Text><Text style={styles.quickTitle}>Post a requirement</Text><Text style={styles.description}>Tell providers what you need →</Text></Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/requirements')} style={styles.textButton}><Text style={styles.textAction}>View my requests →</Text></Pressable>
        {providerAccess ? <Pressable accessibilityRole="button" onPress={() => router.push('/provider')} style={styles.providerCard}><Text style={styles.quickTitle}>Provider workspace</Text><Text style={styles.textAction}>Manage leads and bookings →</Text></Pressable> : null}

        {!loading && !error && marketplace && marketplace.services.length > 0 ? <>
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Explore services</Text><Pressable accessibilityRole="button" onPress={() => router.push('/explore')} style={styles.textButton}><Text style={styles.textAction}>View all →</Text></Pressable></View>
          {marketplace.services.filter((service) => service.provider_id).slice(0, 3).map((service) => <Pressable key={service.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/service/[serviceId]', params: { serviceId: service.id, providerType: service.provider_type, providerId: service.provider_id! } })} style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}>
            <View style={styles.serviceAvatar}><Text style={styles.categoryInitial}>{(service.service_name.en || 'S').slice(0, 1)}</Text></View>
            <View style={styles.serviceCopy}><Text style={styles.quickTitle}>{service.service_name.en || 'Service'}</Text><Text style={styles.description}>{service.provider_name}</Text>{service.review_count > 0 ? <Text style={styles.rating}>★ {service.rating.toFixed(1)} · {service.review_count} reviews</Text> : <Text style={styles.description}>No reviews yet</Text>}<Text style={styles.price}>{formatMarketplacePrice(service)}</Text><Text style={styles.textAction}>View service →</Text></View>
          </Pressable>)}
        </> : null}
      </ScrollView>
      <MobileNav />
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.surface },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 60 },
  logoWrap: { flex: 1, alignItems: 'center', paddingLeft: 48 },
  headerButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  headerSymbol: { fontSize: 25, color: theme.colors.ink },
  smallLabel: { fontSize: 10, color: theme.colors.inkMuted },
  content: { gap: 12, paddingBottom: 24 },
  locationStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, padding: 11, backgroundColor: theme.colors.secondary },
  locationText: { flex: 1, fontSize: 12, fontWeight: '700', color: theme.colors.primaryStrong },
  locationMark: { fontSize: 20, color: theme.colors.primary },
  searchRow: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised },
  searchInput: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 14, fontSize: 14, color: theme.colors.ink },
  searchButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  searchSymbol: { fontSize: 28, color: theme.colors.primary },
  hero: { overflow: 'hidden', padding: 22, gap: 10, borderRadius: theme.radii.xl, backgroundColor: theme.colors.primary, ...cardShadow },
  heroCircle: { position: 'absolute', right: -35, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: '#7865E7' },
  heroEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: '#E8E2FF' },
  heroTitle: { fontSize: 27, lineHeight: 33, fontWeight: '900', color: theme.colors.white },
  heroBody: { fontSize: 13, lineHeight: 19, color: '#F0EDFF' },
  heroAction: { alignSelf: 'flex-start', marginTop: 4, padding: 10, borderRadius: 10, backgroundColor: theme.colors.white, color: theme.colors.primaryStrong, fontSize: 12, fontWeight: '900' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 5 },
  sectionTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: theme.colors.ink },
  textButton: { minHeight: 44, justifyContent: 'center' },
  textAction: { fontSize: 12, fontWeight: '800', color: theme.colors.primary },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  category: { width: '25%', alignItems: 'center', gap: 7, paddingHorizontal: 3, minHeight: 90 },
  categoryIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  categoryInitial: { fontSize: 23, fontWeight: '900', color: theme.colors.primaryStrong },
  categoryName: { textAlign: 'center', fontSize: 11, lineHeight: 15, color: theme.colors.ink, fontWeight: '700' },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, minWidth: 0, gap: 7, padding: 15, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, ...cardShadow },
  quickSymbol: { fontSize: 26, color: theme.colors.primary },
  quickTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.ink },
  description: { fontSize: 12, lineHeight: 18, color: theme.colors.inkMuted },
  providerCard: { gap: 7, padding: 16, borderRadius: theme.radii.lg, backgroundColor: theme.colors.secondary },
  serviceCard: { flexDirection: 'row', gap: 13, padding: 15, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, ...cardShadow },
  serviceAvatar: { width: 62, height: 62, borderRadius: 14, backgroundColor: theme.colors.secondary, alignItems: 'center', justifyContent: 'center' },
  serviceCopy: { flex: 1, minWidth: 0, gap: 4 },
  rating: { fontSize: 12, color: theme.colors.warning },
  price: { fontSize: 13, fontWeight: '800', color: theme.colors.primaryStrong },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyCard: { gap: 7, padding: 15, borderRadius: 14, backgroundColor: theme.colors.surfaceRaised },
  error: { color: theme.colors.danger, fontSize: 13 },
  pressed: { opacity: 0.8 },
});
