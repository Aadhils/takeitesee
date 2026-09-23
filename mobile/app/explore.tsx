import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileNav } from '../components/MobileNav';
import {
  formatMarketplacePrice,
  type MarketplaceService,
  searchMarketplaceServices,
} from '../lib/marketplace';

type SearchState =
  | { status: 'loading'; services: MarketplaceService[]; total: number }
  | { status: 'ready'; services: MarketplaceService[]; total: number }
  | { status: 'error'; services: MarketplaceService[]; total: number; message: string };

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [state, setState] = useState<SearchState>({ status: 'loading', services: [], total: 0 });

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
  }, [submittedQuery]);

  const submit = () => setSubmittedQuery(query.trim());

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>EXPLORE</Text>
          <Text style={styles.title}>Find a service</Text>
          <Text style={styles.description}>
            Search Professional and Business services together from the public marketplace.
          </Text>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submit}
            returnKeyType="search"
            placeholder="Website developer, plumber, salon…"
            style={styles.searchInput}
          />
          <Pressable accessibilityRole="button" onPress={submit} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.inlineStatus}>
            <ActivityIndicator />
            <Text style={styles.muted}>Searching marketplace…</Text>
          </View>
        ) : null}

        {state.status === 'error' ? <Text style={styles.error}>{state.message}</Text> : null}

        {state.status === 'ready' ? (
          <Text style={styles.resultCount}>
            {state.total} {state.total === 1 ? 'service' : 'services'} found
          </Text>
        ) : null}

        <FlatList
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
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{service.service_name.en || 'Service'}</Text>
          <Text style={styles.provider}>{service.provider_name}</Text>
        </View>
        <Text style={styles.price}>{formatMarketplacePrice(service)}</Text>
      </View>
      {service.description.en ? (
        <Text style={styles.descriptionText} numberOfLines={2}>
          {service.description.en}
        </Text>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{service.provider_type === 'business' ? 'Business' : 'Professional'}</Text>
        {service.location ? <Text style={styles.meta}>{service.location}</Text> : null}
        <Text style={styles.meta}>{service.availability}</Text>
      </View>
      <Text style={styles.rating}>
        ★ {service.rating.toFixed(1)} · {service.review_count} reviews
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 12 },
  header: { gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#666678' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#171721' },
  description: { fontSize: 14, lineHeight: 20, color: '#666678' },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#d9d9e3',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#171721',
    backgroundColor: '#ffffff',
  },
  searchButton: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#30304a',
  },
  searchButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultCount: { fontSize: 13, fontWeight: '700', color: '#555565' },
  listContent: { gap: 10, paddingBottom: 8 },
  card: { gap: 9, padding: 16, borderRadius: 16, backgroundColor: '#ffffff' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardTitleWrap: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#171721' },
  provider: { fontSize: 13, color: '#666678' },
  price: { fontSize: 15, fontWeight: '800', color: '#30304a' },
  descriptionText: { fontSize: 14, lineHeight: 20, color: '#555565' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { fontSize: 12, color: '#555565', backgroundColor: '#f0f0f5', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  rating: { fontSize: 12, fontWeight: '700', color: '#555565' },
  muted: { fontSize: 13, lineHeight: 19, color: '#77778a' },
  error: { fontSize: 13, lineHeight: 19, color: '#a12626' },
  emptyCard: { padding: 18, borderRadius: 16, backgroundColor: '#ffffff', gap: 6 },
});
