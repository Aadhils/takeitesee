import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import {
  formatMarketplacePrice,
  type MarketplaceService,
  searchMarketplaceServices,
} from '../lib/marketplace';
import { cardShadow, theme } from '../lib/theme';

type SearchState =
  | { status: 'loading'; services: MarketplaceService[]; total: number }
  | { status: 'ready'; services: MarketplaceService[]; total: number }
  | { status: 'error'; services: MarketplaceService[]; total: number; message: string };

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const incomingQuery = (Array.isArray(params.q) ? params.q[0] : params.q) ?? '';
  const [query, setQuery] = useState(incomingQuery);
  const [submittedQuery, setSubmittedQuery] = useState(incomingQuery);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [state, setState] = useState<SearchState>({ status: 'loading', services: [], total: 0 });

  useEffect(() => {
    setQuery(incomingQuery);
    setSubmittedQuery(incomingQuery.trim());
  }, [incomingQuery]);

  useEffect(() => {
    let active = true;
    setState((current) => ({ status: 'loading', services: current.services, total: current.total }));

    searchMarketplaceServices(submittedQuery)
      .then((result) => {
        if (!active) return;
        setState({ status: 'ready', services: result.services, total: result.total });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: 'error',
          services: [],
          total: 0,
          message: error instanceof Error ? error.message : 'Unable to search services.',
        });
      });

    return () => {
      active = false;
    };
  }, [submittedQuery, searchAttempt]);

  const submit = () => {
    if (state.status === 'loading') return;
    Keyboard.dismiss();
    setSubmittedQuery(query.trim());
    setSearchAttempt((current) => current + 1);
  };

  const retry = () => {
    Keyboard.dismiss();
    setSearchAttempt((current) => current + 1);
  };

  const clearSearch = () => {
    if (state.status === 'loading') return;
    Keyboard.dismiss();
    setQuery('');
    setSubmittedQuery('');
    setSearchAttempt((current) => current + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.brandRow}><BrandLogo compact /></View>
          <Text style={styles.eyebrow}>EXPLORE SERVICES</Text>
          <Text style={styles.title}>Find a service</Text>
          <Text style={styles.description}>
            Discover services and choose a provider that fits your needs.
          </Text>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="Search services"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submit}
            returnKeyType="search"
            placeholder="Website developer, plumber, salon…"
            style={styles.searchInput}
          />
          <Pressable accessibilityRole="button" disabled={state.status === 'loading'} onPress={submit} style={[styles.searchButton, state.status === 'loading' && styles.disabled]}>
            <Text style={styles.searchButtonText}>{state.status === 'loading' ? 'Searching…' : 'Search'}</Text>
          </Pressable>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.inlineStatus}>
            <ActivityIndicator />
            <Text style={styles.muted}>Searching marketplace…</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.emptyCard}>
            <Text accessibilityRole="alert" style={styles.error}>{state.message}</Text>
            <Pressable accessibilityRole="button" onPress={retry} style={styles.recoveryButton}>
              <Text style={styles.recoveryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {submittedQuery && state.status !== 'loading' ? (
          <Pressable accessibilityRole="button" onPress={clearSearch} style={styles.recoveryButton}>
            <Text style={styles.recoveryText}>Clear search · Show all services</Text>
          </Pressable>
        ) : null}

        {state.status === 'ready' ? (
          <Text style={styles.resultCount}>
            {state.total} {state.total === 1 ? 'service' : 'services'} found
          </Text>
        ) : null}

        <FlatList
          keyboardShouldPersistTaps="handled"
          data={state.services}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <ServiceCard service={item} />}
          ListEmptyComponent={
            state.status === 'ready' ? (
              <View style={styles.emptyCard}>
                <Text style={styles.cardTitle}>No matching services yet</Text>
                <Text style={styles.muted}>Try a broader service name or clear the search.</Text>
              </View>
            ) : null
          }
        />

        <MobileNav />
      </View>
    </SafeAreaView>
  );
}

function ServiceCard({ service }: { service: MarketplaceService }) {
  const name = service.service_name.en || 'Service';
  const content = (
    <>
      <View style={styles.cardHeader}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.serviceVisual}>
          <Text style={styles.serviceInitial}>{name.trim().slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle} numberOfLines={2}>{name}</Text>
          <Text style={styles.provider} numberOfLines={2}>{service.provider_name}</Text>
          <Text style={styles.rating}>
            {service.review_count > 0
              ? `★ ${service.rating.toFixed(1)} · ${service.review_count} reviews`
              : 'No reviews yet'}
          </Text>
        </View>
      </View>
      {service.description.en ? (
        <Text style={styles.descriptionText} numberOfLines={2}>{service.description.en}</Text>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{service.provider_type === 'business' ? 'Business' : 'Professional'}</Text>
        {service.location ? <Text style={styles.meta}>{service.location}</Text> : null}
        <Text style={styles.meta}>{service.availability}</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.price}>{formatMarketplacePrice(service)}</Text>
        {service.provider_id ? (
          <View style={styles.openAction}><Text style={styles.openText}>View service →</Text></View>
        ) : <Text style={styles.muted}>Details unavailable</Text>}
      </View>
    </>
  );

  if (!service.provider_id) return <View style={styles.card}>{content}</View>;

  return (
    <Link
      href={{
        pathname: '/service/[serviceId]',
        params: {
          serviceId: service.id,
          providerType: service.provider_type,
          providerId: service.provider_id,
        },
      }}
      asChild
    >
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${name} from ${service.provider_name}`} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        {content}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 12 },
  header: { gap: 5 },
  brandRow: { alignItems: 'center', paddingBottom: 6 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: theme.colors.primary },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.4, color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
  },
  searchButton: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primary,
  },
  disabled: { opacity: 0.5 },
  recoveryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: theme.radii.md, backgroundColor: theme.colors.secondary },
  recoveryText: { color: theme.colors.primaryStrong, fontSize: 13, fontWeight: '800' },
  searchButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultCount: { fontSize: 13, fontWeight: '800', color: theme.colors.inkMuted },
  listContent: { gap: 10, paddingBottom: 8 },
  card: { gap: 9, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, ...cardShadow },
  cardPressed: { opacity: 0.82 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardTitleWrap: { flex: 1, minWidth: 0, gap: 4 },
  serviceVisual: { width: 64, height: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.secondary },
  serviceInitial: { fontSize: 30, fontWeight: '900', color: theme.colors.primaryStrong },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  openAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: theme.colors.primary },
  cardTitle: { fontSize: 17, fontWeight: '900', color: theme.colors.ink },
  provider: { fontSize: 13, color: theme.colors.inkMuted },
  price: { fontSize: 15, fontWeight: '900', color: theme.colors.primaryStrong },
  descriptionText: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { fontSize: 12, color: theme.colors.primaryStrong, backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: theme.radii.sm },
  rating: { fontSize: 12, fontWeight: '700', color: theme.colors.inkMuted },
  openText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  muted: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  error: { fontSize: 13, lineHeight: 19, color: '#a12626' },
  emptyCard: { padding: 18, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, gap: 6 },
});
