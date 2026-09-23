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

import { MobileNav } from '../components/MobileNav';
import {
  fetchCustomerRequirements,
  formatRequirementMoney,
  type CustomerRequirementSummary,
} from '../lib/requirements';
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
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>MY REQUESTS</Text>
            <Text style={styles.title}>Requirements</Text>
            <Text style={styles.description}>
              Track provider proposals from the same Customer account you use on the web.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRefreshKey((value) => value + 1)}
            style={styles.refreshButton}
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        <Link href="/request-service" asChild>
          <Pressable style={styles.newButton}>
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
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.reference}>{requirement.reference}</Text>
            <Text style={styles.cardTitle}>{requirement.title}</Text>
          </View>
          <Text style={styles.status}>{requirement.status}</Text>
        </View>

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
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#666678' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#171721' },
  description: { fontSize: 14, lineHeight: 20, color: '#666678' },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ededf4' },
  refreshText: { fontSize: 12, fontWeight: '800', color: '#3f3f58' },
  newButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#30304a' },
  newButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeCard: { padding: 12, borderRadius: 12, backgroundColor: '#fff8e7' },
  noticeText: { fontSize: 12, lineHeight: 18, color: '#66522b' },
  listContent: { gap: 10, paddingBottom: 8 },
  card: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  cardPressed: { opacity: 0.82 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, gap: 3 },
  reference: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, color: '#77778a' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#171721' },
  status: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: '#4b4b65', backgroundColor: '#efeff5', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  cardDescription: { fontSize: 13, lineHeight: 19, color: '#5c5c70' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { fontSize: 11, color: '#555565', backgroundColor: '#f3f3f7', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  proposalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  proposalText: { fontSize: 12, fontWeight: '700', color: '#555565' },
  unread: { fontSize: 11, fontWeight: '800', color: '#fff', backgroundColor: '#30304a', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  emptyCard: { padding: 18, borderRadius: 16, backgroundColor: '#fff', gap: 6 },
  muted: { fontSize: 13, lineHeight: 19, color: '#77778a' },
  error: { fontSize: 13, lineHeight: 19, color: '#a12626' },
});
