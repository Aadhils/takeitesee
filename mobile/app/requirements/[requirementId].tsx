import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  decideCustomerRequirementProposal,
  fetchCustomerRequirementDetail,
  formatRequirementMoney,
  providerParamsFromProfileHref,
  requirementRelationName,
  type RequirementDetailResponse,
  type RequirementProposal,
} from '../../lib/requirements';
import { useAuth } from '../../providers/AuthProvider';

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; data: RequirementDetailResponse }
  | { status: 'error'; message: string };

type PendingDecision = { proposalId: string; decision: 'accept' | 'decline' } | null;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function budgetLabel(requirement: RequirementDetailResponse['requirement']) {
  if (requirement.budget_type === 'negotiable') return 'Negotiable';
  if (requirement.budget_type === 'fixed') {
    return formatRequirementMoney(requirement.budget_min_minor ?? 0, requirement.currency);
  }
  return `${formatRequirementMoney(requirement.budget_min_minor ?? 0, requirement.currency)} – ${formatRequirementMoney(requirement.budget_max_minor ?? 0, requirement.currency)}`;
}

function proposalStatusPriority(status: RequirementProposal['status']) {
  if (status === 'accepted') return 0;
  if (status === 'submitted') return 1;
  if (status === 'declined') return 2;
  return 3;
}

export default function RequirementDetailScreen() {
  const params = useLocalSearchParams<{ requirementId?: string | string[] }>();
  const requirementId = firstParam(params.requirementId)?.trim() ?? '';
  const auth = useAuth();
  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const [pendingDecision, setPendingDecision] = useState<PendingDecision>(null);
  const [busyProposalId, setBusyProposalId] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn' || !requirementId) return;
    setState({ status: 'loading' });
    try {
      const data = await fetchCustomerRequirementDetail(requirementId);
      setState({ status: 'ready', data });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to load requirement.',
      });
    }
  }, [auth.status, requirementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const orderedProposals = useMemo(() => {
    if (state.status !== 'ready') return [];
    return [...state.data.proposals].sort((left, right) => {
      const statusDiff = proposalStatusPriority(left.status) - proposalStatusPriority(right.status);
      if (statusDiff !== 0) return statusDiff;
      return new Date(right.submitted_at).getTime() - new Date(left.submitted_at).getTime();
    });
  }, [state]);

  const decide = async (proposal: RequirementProposal, decision: 'accept' | 'decline') => {
    if (state.status !== 'ready' || busyProposalId) return;
    const requirement = state.data.requirement;
    if (requirement.schedule_pattern !== 'one_time') return;
    if (!['open', 'paused'].includes(requirement.status)) return;
    if (proposal.status !== 'submitted') return;
    if (decision === 'accept' && proposal.provider_marketplace_status === 'ineligible') return;

    setBusyProposalId(proposal.id);
    setActionError('');
    setNotice('');
    try {
      await decideCustomerRequirementProposal(requirementId, proposal.id, decision);
      setPendingDecision(null);
      setNotice(decision === 'accept' ? 'Provider selected.' : 'Proposal declined.');
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Proposal decision could not be saved.');
    } finally {
      setBusyProposalId('');
    }
  };

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
      <ScrollView contentContainerStyle={styles.content}>
        <Link href="/requirements" asChild>
          <Pressable style={styles.backButton}>
            <Text style={styles.backText}>‹ Back to Requirements</Text>
          </Pressable>
        </Link>

        {state.status === 'loading' ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading requirement and proposals…</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Requirement unavailable</Text>
            <Text style={styles.errorText}>{state.message}</Text>
            <Pressable onPress={() => void load()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {state.status === 'ready' ? (
          <RequirementContent
            data={state.data}
            proposals={orderedProposals}
            pendingDecision={pendingDecision}
            busyProposalId={busyProposalId}
            notice={notice}
            actionError={actionError}
            onAskDecision={(proposalId, decision) => setPendingDecision({ proposalId, decision })}
            onCancelDecision={() => setPendingDecision(null)}
            onDecide={decide}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function RequirementContent({
  data,
  proposals,
  pendingDecision,
  busyProposalId,
  notice,
  actionError,
  onAskDecision,
  onCancelDecision,
  onDecide,
}: {
  data: RequirementDetailResponse;
  proposals: RequirementProposal[];
  pendingDecision: PendingDecision;
  busyProposalId: string;
  notice: string;
  actionError: string;
  onAskDecision(proposalId: string, decision: 'accept' | 'decline'): void;
  onCancelDecision(): void;
  onDecide(proposal: RequirementProposal, decision: 'accept' | 'decline'): Promise<void>;
}) {
  const requirement = data.requirement;
  const categoryName = requirementRelationName(requirement.platform_categories);
  const locationName = requirementRelationName(requirement.platform_locations);
  const nativeActionsAllowed = requirement.schedule_pattern === 'one_time' && ['open', 'paused'].includes(requirement.status);

  return (
    <>
      {notice ? <View style={styles.successNotice}><Text style={styles.successText}>{notice}</Text></View> : null}
      {actionError ? <View style={styles.errorCard}><Text style={styles.errorText}>{actionError}</Text></View> : null}

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>{requirement.requirement_reference}</Text>
            <Text style={styles.title}>{requirement.title}</Text>
          </View>
          <Text style={styles.status}>{requirement.status}</Text>
        </View>
        <Text style={styles.description}>{requirement.description}</Text>
        <View style={styles.metaRow}>
          {categoryName ? <Text style={styles.meta}>{categoryName}</Text> : null}
          {locationName ? <Text style={styles.meta}>{locationName}</Text> : null}
          <Text style={styles.meta}>{requirement.service_mode}</Text>
          <Text style={styles.meta}>{budgetLabel(requirement)}</Text>
          <Text style={styles.meta}>{requirement.schedule_pattern === 'recurring' ? 'Recurring' : 'One-time'}</Text>
        </View>
      </View>

      {requirement.schedule_pattern === 'recurring' ? (
        <View style={styles.freezeCard}>
          <Text style={styles.cardTitle}>Recurring requirement · read-only in native v1</Text>
          <Text style={styles.muted}>
            You can review the requirement and proposals here. Recurrence decisions, occurrence recovery and recurring scheduling remain outside the native v1 action flow.
          </Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.eyebrow}>PROVIDER PROPOSALS</Text>
          <Text style={styles.sectionTitle}>Compare responses</Text>
        </View>
        <Text style={styles.proposalCount}>{proposals.length}</Text>
      </View>

      {proposals.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No proposals yet</Text>
          <Text style={styles.muted}>Providers can respond while this requirement remains open.</Text>
        </View>
      ) : (
        proposals.map((proposal) => {
          const providerParams = providerParamsFromProfileHref(proposal.provider_profile_href);
          const pending = pendingDecision?.proposalId === proposal.id ? pendingDecision.decision : null;
          const canAct = nativeActionsAllowed && proposal.status === 'submitted';
          const canAccept = canAct && proposal.provider_marketplace_status !== 'ineligible';
          const busy = busyProposalId === proposal.id;

          return (
            <View key={proposal.id} style={styles.card}>
              <View style={styles.proposalHeader}>
                <View style={styles.proposalCopy}>
                  <Text style={styles.reference}>{proposal.proposal_reference}</Text>
                  <Text style={styles.cardTitle}>{proposal.provider_display_name}</Text>
                  <Text style={styles.muted}>{proposal.provider_type} · {proposal.service_name}</Text>
                </View>
                <Text style={styles.status}>{proposal.status}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.meta}>{formatRequirementMoney(proposal.amount_minor, proposal.currency)}</Text>
                <Text style={styles.meta}>{proposal.pricing_basis === 'whole_requirement' ? 'Whole requirement' : 'Per service'}</Text>
                <Text style={styles.meta}>{proposal.provider_marketplace_status ?? 'eligibility unavailable'}</Text>
              </View>

              {proposal.message ? <Text style={styles.description}>{proposal.message}</Text> : null}

              {providerParams ? (
                <Link
                  href={{
                    pathname: '/providers/[providerType]/[providerId]',
                    params: providerParams,
                  }}
                  asChild
                >
                  <Pressable style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>View provider profile</Text>
                  </Pressable>
                </Link>
              ) : null}

              {proposal.provider_marketplace_status === 'ineligible' && proposal.status === 'submitted' ? (
                <Text style={styles.warningText}>This provider/service is currently unavailable for new marketplace work.</Text>
              ) : null}

              {canAct && !pending ? (
                <View style={styles.actionRow}>
                  <Pressable
                    disabled={!canAccept || busy}
                    onPress={() => onAskDecision(proposal.id, 'accept')}
                    style={[styles.primaryButton, (!canAccept || busy) && styles.buttonDisabled]}
                  >
                    <Text style={styles.primaryButtonText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => onAskDecision(proposal.id, 'decline')}
                    style={[styles.dangerButton, busy && styles.buttonDisabled]}
                  >
                    <Text style={styles.dangerButtonText}>Decline</Text>
                  </Pressable>
                </View>
              ) : null}

              {pending ? (
                <View style={pending === 'accept' ? styles.confirmAccept : styles.confirmDecline}>
                  <Text style={styles.confirmTitle}>
                    {pending === 'accept'
                      ? `Select ${proposal.provider_display_name}?`
                      : `Decline ${proposal.provider_display_name}'s proposal?`}
                  </Text>
                  <Text style={styles.muted}>
                    {pending === 'accept'
                      ? 'This chooses the provider using the existing server proposal decision. Scheduling and booking remain a separate server-controlled step.'
                      : 'The provider proposal will be marked declined by the server.'}
                  </Text>
                  <View style={styles.actionRow}>
                    <Pressable
                      disabled={busy}
                      onPress={() => void onDecide(proposal, pending)}
                      style={[pending === 'accept' ? styles.primaryButton : styles.dangerButton, busy && styles.buttonDisabled]}
                    >
                      {busy ? (
                        <ActivityIndicator color={pending === 'accept' ? '#fff' : '#8b2b2b'} />
                      ) : (
                        <Text style={pending === 'accept' ? styles.primaryButtonText : styles.dangerButtonText}>
                          Confirm {pending}
                        </Text>
                      )}
                    </Pressable>
                    <Pressable disabled={busy} onPress={onCancelDecision} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Keep reviewing</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  content: { padding: 18, gap: 14 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 7, paddingRight: 12 },
  backText: { fontSize: 14, fontWeight: '700', color: '#42425f' },
  loadingCard: { padding: 20, borderRadius: 18, backgroundColor: '#fff', gap: 10, alignItems: 'center' },
  errorCard: { padding: 16, borderRadius: 14, backgroundColor: '#fff0f0', gap: 8 },
  errorTitle: { fontSize: 17, fontWeight: '800', color: '#7f2020' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
  successNotice: { padding: 13, borderRadius: 12, backgroundColor: '#edf8ef' },
  successText: { fontSize: 13, fontWeight: '700', color: '#285c33' },
  heroCard: { padding: 20, borderRadius: 20, backgroundColor: '#fff', gap: 10 },
  heroHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  heroCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, color: '#77778a' },
  reference: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, color: '#77778a' },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: '#171721' },
  description: { fontSize: 14, lineHeight: 21, color: '#555565' },
  status: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#4b4b65', backgroundColor: '#efeff5', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { fontSize: 11, color: '#555565', backgroundColor: '#f3f3f7', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  freezeCard: { padding: 16, borderRadius: 16, backgroundColor: '#fff8e7', gap: 6 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#171721' },
  proposalCount: { minWidth: 34, textAlign: 'center', fontSize: 13, fontWeight: '800', color: '#fff', backgroundColor: '#30304a', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999 },
  card: { padding: 17, borderRadius: 18, backgroundColor: '#fff', gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#171721' },
  proposalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  proposalCopy: { flex: 1, gap: 3 },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  primaryButton: { minHeight: 44, flexGrow: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#30304a', paddingHorizontal: 15 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  secondaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#ededf4', paddingHorizontal: 14 },
  secondaryButtonText: { color: '#30304a', fontSize: 13, fontWeight: '800' },
  dangerButton: { minHeight: 44, flexGrow: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#fff0f0', paddingHorizontal: 15 },
  dangerButtonText: { color: '#8b2b2b', fontSize: 13, fontWeight: '800' },
  buttonDisabled: { opacity: 0.45 },
  confirmAccept: { padding: 14, borderRadius: 14, backgroundColor: '#edf8ef', gap: 9 },
  confirmDecline: { padding: 14, borderRadius: 14, backgroundColor: '#fff3f3', gap: 9 },
  confirmTitle: { fontSize: 14, fontWeight: '800', color: '#333342' },
  warningText: { fontSize: 12, lineHeight: 18, color: '#7a5b24' },
  muted: { fontSize: 13, lineHeight: 19, color: '#77778a' },
});
