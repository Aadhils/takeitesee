import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchPublicProvider,
  findProviderService,
  formatPublicServicePrice,
  type PublicProviderProfile,
  type PublicProviderService,
  type PublicProviderType,
} from '../../lib/providers';

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; provider: PublicProviderProfile; service: PublicProviderService }
  | { status: 'error'; message: string };

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function providerTypeParam(value: string | undefined): PublicProviderType | null {
  return value === 'professional' || value === 'business' ? value : null;
}

export default function ServiceDetailScreen() {
  const params = useLocalSearchParams<{
    serviceId?: string | string[];
    providerType?: string | string[];
    providerId?: string | string[];
  }>();
  const serviceId = firstParam(params.serviceId)?.trim() ?? '';
  const providerType = providerTypeParam(firstParam(params.providerType));
  const providerId = firstParam(params.providerId)?.trim() ?? '';
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    if (!serviceId || !providerType || !providerId) {
      setState({ status: 'error', message: 'Service context is incomplete.' });
      return () => {
        active = false;
      };
    }

    setState({ status: 'loading' });
    fetchPublicProvider(providerType, providerId)
      .then(({ provider }) => {
        if (!active) return;
        const service = findProviderService(provider, serviceId);
        if (!service) {
          setState({ status: 'error', message: 'This service is no longer publicly available.' });
          return;
        }
        setState({ status: 'ready', provider, service });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to load service details.',
        });
      });

    return () => {
      active = false;
    };
  }, [providerId, providerType, serviceId]);

  const requestHref = useMemo(() => {
    if (state.status !== 'ready') return null;
    const params = new URLSearchParams({
      title: state.service.name,
      description: state.service.description,
      location: state.service.location || state.provider.location || '',
    });
    return `/request-service?${params.toString()}`;
  }, [state]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Link href="/explore" asChild>
          <Pressable style={styles.backButton}>
            <Text style={styles.backText}>‹ Back to Explore</Text>
          </Pressable>
        </Link>

        {state.status === 'loading' ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading verified service…</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Service unavailable</Text>
            <Text style={styles.errorText}>{state.message}</Text>
          </View>
        ) : null}

        {state.status === 'ready' ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.eyebrow}>VERIFIED SERVICE</Text>
              <Text style={styles.title}>{state.service.name}</Text>
              <Text style={styles.providerName}>{state.provider.name}</Text>
              {state.service.description ? (
                <Text style={styles.description}>{state.service.description}</Text>
              ) : null}
              <View style={styles.metaRow}>
                <Text style={styles.meta}>{formatPublicServicePrice(state.service)}</Text>
                {state.service.duration_minutes ? (
                  <Text style={styles.meta}>{state.service.duration_minutes} min</Text>
                ) : null}
                {state.service.location || state.provider.location ? (
                  <Text style={styles.meta}>{state.service.location || state.provider.location}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.actionsCard}>
              <Link
                href={{
                  pathname: '/providers/[providerType]/[providerId]',
                  params: { providerType: state.provider.provider_type, providerId: state.provider.id },
                }}
                asChild
              >
                <Pressable style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>View provider profile</Text>
                </Pressable>
              </Link>

              {requestHref ? (
                <Link href={requestHref} asChild>
                  <Pressable style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Request this service</Text>
                  </Pressable>
                </Link>
              ) : null}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Provider disclosure</Text>
              <Text style={styles.infoText}>
                {state.provider.marketplace_disclosure.legal_name || state.provider.name}
              </Text>
              {state.provider.marketplace_disclosure.principal_address ? (
                <Text style={styles.muted}>{state.provider.marketplace_disclosure.principal_address}</Text>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  content: { padding: 18, gap: 14 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 7, paddingRight: 12 },
  backText: { fontSize: 14, fontWeight: '700', color: '#42425f' },
  loadingCard: { padding: 20, borderRadius: 18, backgroundColor: '#fff', gap: 10, alignItems: 'center' },
  errorCard: { padding: 20, borderRadius: 18, backgroundColor: '#fff0f0', gap: 8 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#7f2020' },
  errorText: { fontSize: 14, lineHeight: 20, color: '#8b3535' },
  heroCard: { padding: 20, borderRadius: 20, backgroundColor: '#fff', gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#666678' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#171721' },
  providerName: { fontSize: 15, fontWeight: '700', color: '#4b4b65' },
  description: { fontSize: 15, lineHeight: 22, color: '#555565' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  meta: { fontSize: 12, color: '#44445d', backgroundColor: '#f0f0f5', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 },
  actionsCard: { padding: 16, borderRadius: 18, backgroundColor: '#fff', gap: 10 },
  primaryButton: { minHeight: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#30304a' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#ededf4' },
  secondaryButtonText: { color: '#30304a', fontSize: 14, fontWeight: '800' },
  infoCard: { padding: 18, borderRadius: 18, backgroundColor: '#fff', gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#171721' },
  infoText: { fontSize: 14, color: '#44445d' },
  muted: { fontSize: 13, lineHeight: 19, color: '#77778a' },
});
