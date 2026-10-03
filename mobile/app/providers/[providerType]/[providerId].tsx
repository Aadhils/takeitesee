import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../../../components/BrandLogo';

import {
  fetchPublicProvider,
  formatPublicServicePrice,
  type PublicProviderProfile,
  type PublicProviderType,
} from '../../../lib/providers';
import { theme } from '../../../lib/theme';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function providerTypeParam(value: string | undefined): PublicProviderType | null {
  return value === 'professional' || value === 'business' ? value : null;
}

type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; provider: PublicProviderProfile }
  | { status: 'error'; message: string };

export default function ProviderProfileScreen() {
  const params = useLocalSearchParams<{
    providerType?: string | string[];
    providerId?: string | string[];
  }>();
  const providerType = providerTypeParam(firstParam(params.providerType));
  const providerId = firstParam(params.providerId)?.trim() ?? '';
  const [state, setState] = useState<ProfileState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    if (!providerType || !providerId) {
      setState({ status: 'error', message: 'Provider context is incomplete.' });
      return () => {
        active = false;
      };
    }

    setState({ status: 'loading' });
    fetchPublicProvider(providerType, providerId)
      .then(({ provider }) => {
        if (active) setState({ status: 'ready', provider });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to load provider profile.',
        });
      });

    return () => {
      active = false;
    };
  }, [providerId, providerType]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}><BrandLogo compact /></View>
        <Link href="/explore" asChild>
          <Pressable accessibilityRole="button" style={styles.backButton}>
            <Text style={styles.backText}>‹ Back to Explore</Text>
          </Pressable>
        </Link>

        {state.status === 'loading' ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading public provider profile…</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Provider unavailable</Text>
            <Text style={styles.errorText}>{state.message}</Text>
          </View>
        ) : null}

        {state.status === 'ready' ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.eyebrow}>
                {state.provider.provider_type === 'business' ? 'BUSINESS PROVIDER' : 'PROFESSIONAL PROVIDER'}
              </Text>
              <View style={styles.providerHeading}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.providerVisual}>
                  <Text style={styles.providerInitial}>{state.provider.name.trim().slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.headingCopy}>
                  <Text style={styles.title}>{state.provider.name}</Text>
                  {state.provider.location ? <Text style={styles.location}>{state.provider.location}</Text> : null}
                </View>
              </View>
              {state.provider.description ? (
                <Text style={styles.description}>{state.provider.description}</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Services</Text>
              {state.provider.services.length ? (
                state.provider.services.map((service) => (
                  <Link
                    key={service.id}
                    href={{
                      pathname: '/service/[serviceId]',
                      params: {
                        serviceId: service.id,
                        providerType: state.provider.provider_type,
                        providerId: state.provider.id,
                      },
                    }}
                    asChild
                  >
                    <Pressable accessibilityRole="button" accessibilityLabel={`View ${service.name}`} style={({ pressed }) => [styles.serviceRow, pressed && styles.pressed]}>
                      <View style={styles.serviceCopy}>
                        <Text style={styles.serviceName}>{service.name}</Text>
                        {service.description ? (
                          <Text style={styles.muted} numberOfLines={2}>{service.description}</Text>
                        ) : null}
                      </View>
                      <View style={styles.serviceFooter}>
                        <Text style={styles.price}>{formatPublicServicePrice(service)}</Text>
                        <View style={styles.serviceAction}><Text style={styles.serviceActionText}>View service →</Text></View>
                      </View>
                    </Pressable>
                  </Link>
                ))
              ) : (
                <Text style={styles.muted}>No active public services are available right now.</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Public contact</Text>
              {state.provider.public_contact.email ? (
                <Text style={styles.infoText}>{state.provider.public_contact.email}</Text>
              ) : null}
              {state.provider.public_contact.phone ? (
                <Text style={styles.infoText}>{state.provider.public_contact.phone}</Text>
              ) : null}
              {!state.provider.public_contact.email && !state.provider.public_contact.phone ? (
                <Text style={styles.muted}>No public contact details are listed.</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Marketplace disclosure</Text>
              <Text style={styles.infoText}>
                {state.provider.marketplace_disclosure.legal_name || state.provider.name}
              </Text>
              {state.provider.marketplace_disclosure.principal_address ? (
                <Text style={styles.muted}>{state.provider.marketplace_disclosure.principal_address}</Text>
              ) : null}
              {state.provider.marketplace_disclosure.grievance_officer_name ? (
                <Text style={styles.muted}>
                  Grievance: {state.provider.marketplace_disclosure.grievance_officer_name}
                  {state.provider.marketplace_disclosure.grievance_officer_designation
                    ? ` · ${state.provider.marketplace_disclosure.grievance_officer_designation}`
                    : ''}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 18, paddingBottom: 28, gap: 14 },
  brandRow: { alignItems: 'center' },
  providerHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingCopy: { flex: 1, minWidth: 0, gap: 5 },
  providerVisual: { width: 64, height: 72, borderRadius: 14, backgroundColor: theme.colors.secondary, alignItems: 'center', justifyContent: 'center' },
  providerInitial: { fontSize: 30, fontWeight: '900', color: theme.colors.primaryStrong },
  serviceFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  serviceAction: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, backgroundColor: theme.colors.primary },
  serviceActionText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  pressed: { opacity: 0.8 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingRight: 12 },
  backText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
  loadingCard: { padding: 20, borderRadius: 18, backgroundColor: '#fff', gap: 10, alignItems: 'center' },
  errorCard: { padding: 20, borderRadius: 18, backgroundColor: '#fff0f0', gap: 8 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#7f2020' },
  errorText: { fontSize: 14, lineHeight: 20, color: '#8b3535' },
  heroCard: { padding: 20, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20, backgroundColor: '#fff', gap: 8 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: theme.colors.primary },
  title: { fontSize: 23, lineHeight: 29, fontWeight: '800', color: theme.colors.ink },
  location: { fontSize: 14, fontWeight: '700', color: theme.colors.inkMuted },
  description: { fontSize: 15, lineHeight: 22, color: theme.colors.inkMuted },
  card: { padding: 18, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: '#fff', gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.ink },
  serviceRow: { gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: theme.colors.border },
  serviceCopy: { minWidth: 0, gap: 4 },
  serviceName: { fontSize: 15, fontWeight: '800', color: theme.colors.ink },
  price: { fontSize: 13, fontWeight: '800', color: theme.colors.inkMuted },
  infoText: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  muted: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
});
