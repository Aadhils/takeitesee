import { Link, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import {
  fetchCustomerRequirements,
  formatRequirementMoney,
  type CustomerRequirementSummary,
} from '../lib/requirements';
import { cardShadow, theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

type ListState =
  | { status: 'loading'; requirements: CustomerRequirementSummary[] }
  | { status: 'ready'; requirements: CustomerRequirementSummary[]; attentionStatus: 'ready' | 'unavailable' }
  | { status: 'error'; requirements: CustomerRequirementSummary[]; message: string };

function budgetLabel(row: CustomerRequirementSummary) {
  if (row.budget_type === 'negotiable') return 'Negotiable';
  if (row.budget_type === 'fixed') return formatRequirementMoney(row.budget_min_minor ?? 0, row.currency);
  return `${formatRequirementMoney(row.budget_min_minor ?? 0, row.currency)} – ${formatRequirementMoney(row.budget_max_minor ?? 0, row.currency)}`;
}

export default function RequirementsScreen() {
  const auth = useAuth();
  const [state, setState] = useState<ListState>({ status: 'loading', requirements: [] });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (auth.status !== 'signedIn') return;
    let active = true;
    setState((current) => ({ status: 'loading', requirements: current.requirements }));

    fetchCustomerRequirements()
      .then((result) => {
        if (!active) return;
        setState({
          status: 'ready',
          requirements: result.requirements,
          attentionStatus: result.proposal_attention_status,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: 'error',
          requirements: [],
          message: error instanceof Error ? error.message : 'Unable to load requirements.',
        });
      });

    return () => {
      active = false;
    };
  }, [auth.status, refreshKey]);

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.muted}>Checking your account…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (auth.status === 'signedOut') return <Redirect href="/login" />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.brandRow}><BrandLogo compact /></View>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>MY REQUESTS</Text>
            <Text style={styles.title}>My service requests</Text>
            <Text style={styles.description}>
              Track your service requests and Provider proposals in one place.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRefreshKey((value) => value + 1)}
            disabled={state.status === 'loading'}
            style={[styles.refreshButton, state.status === 'loading' && styles.disabled]}
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        <Link href="/request-service" asChild>
          <Pressable accessibilityRole="button" style={styles.newButton}>
            <Text style={styles.newButtonText}>+ Post a requirement</Text>
          </Pressable>
        </Link>

        {state.status === 'loading' ? (
          <View style={styles.inlineStatus}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading your requirements…</Text>
          </View>
        ) : null}

        {state.status === 'error' ? <Text style={styles.error}>{state.message}</Text> : null}

        {state.status === 'ready' && state.attentionStatus === 'unavailable' ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>
              Proposal attention counts are temporarily unavailable. Requirement data is still current.
            </Text>
          </View>
        ) : null}

        <FlatList
          data={state.requirements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <RequirementCard requirement={item} />}
          ListEmptyComponent={
            state.status === 'ready' ? (
              <View style={styles.emptyCard}>
                <Text style={styles.cardTitle}>No requirements yet</Text>
                <Text style={styles.muted}>Post a service requirement when you want providers to respond with proposals.</Text>
              </View>
            ) : null
          }
        />

        <MobileNav />
      </View>
    </SafeAreaView>
  );
}

function RequirementCard({ requirement }: { requirement: CustomerRequirementSummary }) {
  const unread = requirement.unread_proposal_count ?? 0;
  const proposals = requirement.submitted_proposal_count ?? requirement.proposal_count ?? 0;

  return (
    <Link
      href={{ pathname: '/requirements/[requirementId]', params: { requirementId: requirement.id } }}
      asChild
    >
      <Pressable accessibilityRole="button" accessibilityLabel={`View request ${requirement.title}`} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.reference}>{requirement.reference}</Text>
            <Text style={styles.cardTitle}>{requirement.title}</Text>
          </View>
          
        </View>

        <Text style={styles.status}>{requirement.status}</Text>
        {requirement.description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>{requirement.description}</Text>
        ) : null}

        <View style={styles.metaRow}>
          {requirement.category_name ? <Text style={styles.meta}>{requirement.category_name}</Text> : null}
          {requirement.location_name ? <Text style={styles.meta}>{requirement.location_name}</Text> : null}
          <Text style={styles.meta}>{budgetLabel(requirement)}</Text>
          <Text style={styles.meta}>{requirement.schedule_pattern === 'recurring' ? 'Recurring' : 'One-time'}</Text>
        </View>

        <View style={styles.proposalRow}>
          <Text style={styles.proposalText}>{proposals} active proposal{proposals === 1 ? '' : 's'}</Text>
          {unread > 0 ? <Text style={styles.unread}>{unread} new</Text> : null}
        </View>
        <View style={styles.openAction}><Text style={styles.openText}>View request →</Text></View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: theme.colors.primary },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  brandRow: { alignItems: 'center', paddingBottom: 6 },
  disabled: { opacity: 0.5 },
  openAction: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: theme.colors.primary },
  openText: { fontSize: 13, fontWeight: '800', color: theme.colors.white },
  refreshButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: theme.radii.md, backgroundColor: theme.colors.secondary },
  refreshText: { fontSize: 12, fontWeight: '900', color: theme.colors.primaryStrong },
  newButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.md, backgroundColor: theme.colors.primary, ...cardShadow },
  newButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeCard: { padding: 12, borderRadius: 12, backgroundColor: '#fff8e7' },
  noticeText: { fontSize: 12, lineHeight: 18, color: '#66522b' },
  listContent: { gap: 10, paddingBottom: 8 },
  card: { gap: 10, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, ...cardShadow },
  cardPressed: { opacity: 0.82 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, minWidth: 0, gap: 3 },
  reference: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, color: theme.colors.inkMuted },
  cardTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.ink },
  status: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: theme.colors.primaryStrong, backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  cardDescription: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { fontSize: 11, color: theme.colors.inkMuted, backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  proposalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  proposalText: { fontSize: 12, fontWeight: '700', color: theme.colors.inkMuted },
  unread: { fontSize: 11, fontWeight: '900', color: theme.colors.white, backgroundColor: theme.colors.primary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: theme.radii.pill },
  emptyCard: { padding: 18, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, gap: 6, ...cardShadow },
  muted: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  error: { fontSize: 13, lineHeight: 19, color: '#a12626' },
});
