import { Link, Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import {
  fetchProviderRequirementLeads,
  formatProviderLeadMoney,
  markProviderRequirementLeadsSeen,
  submitOneTimeRequirementProposal,
  type ProviderRequirementLead,
  type ProviderRequirementMarketplace,
  type ProviderRequirementProposal,
} from '../lib/provider-leads';
import { cardShadow, theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';

type ProviderState =
  | { status: 'loading'; marketplace: ProviderRequirementMarketplace }
  | { status: 'ready'; marketplace: ProviderRequirementMarketplace }
  | { status: 'error'; marketplace: ProviderRequirementMarketplace; message: string };

type Draft = {
  leadId: string;
  amount: string;
  message: string;
};

const emptyMarketplace: ProviderRequirementMarketplace = { leads: [], proposals: [] };

function leadBudget(lead: ProviderRequirementLead) {
  if (lead.budget_type === 'negotiable') return 'Negotiable';
  if (lead.budget_type === 'fixed') return formatProviderLeadMoney(lead.budget_min_minor, lead.currency);
  return `${formatProviderLeadMoney(lead.budget_min_minor, lead.currency)} – ${formatProviderLeadMoney(lead.budget_max_minor, lead.currency)}`;
}

export default function ProviderScreen() {
  const auth = useAuth();
  const [state, setState] = useState<ProviderState>({ status: 'loading', marketplace: emptyMarketplace });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busyLeadId, setBusyLeadId] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const isProfessional = auth.status === 'signedIn' && auth.identity.roles.includes('professional');
  const isBusiness = auth.status === 'signedIn' && auth.identity.roles.includes('business_owner');
  const hasProviderAccess = isProfessional || isBusiness;

  const load = useCallback(async () => {
    if (auth.status !== 'signedIn' || !hasProviderAccess) return;
    setState((current) => ({ status: 'loading', marketplace: current.marketplace }));
    try {
      const result = await fetchProviderRequirementLeads();
      setState({ status: 'ready', marketplace: result.marketplace });
      void markProviderRequirementLeadsSeen().catch(() => undefined);
    } catch (error) {
      setState({
        status: 'error',
        marketplace: emptyMarketplace,
        message: error instanceof Error ? error.message : 'Unable to load provider leads.',
      });
    }
  }, [auth.status, hasProviderAccess]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const proposedRequirementIds = useMemo(
    () => new Set(state.marketplace.proposals.map((proposal) => proposal.requirement_id)),
    [state.marketplace.proposals],
  );

  if (auth.status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.muted}>Checking provider access…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  if (!hasProviderAccess) return <Redirect href="/home" />;

  const providerType = isProfessional ? 'Professional' : 'Business';

  const openDraft = (lead: ProviderRequirementLead) => {
    if (lead.schedule_pattern !== 'one_time') return;
    const initialAmount = lead.budget_type === 'fixed' && lead.budget_min_minor && lead.budget_min_minor > 0
      ? String(lead.budget_min_minor / 100)
      : '';
    setDraft({ leadId: lead.id, amount: initialAmount, message: '' });
    setActionError('');
    setNotice('');
  };

  const submit = async (lead: ProviderRequirementLead) => {
    if (!draft || draft.leadId !== lead.id || busyLeadId) return;
    if (lead.schedule_pattern !== 'one_time') return;
    const amount = Number(draft.amount);
    const message = draft.message.trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError('Enter a positive proposal amount.');
      return;
    }
    if (message.length < 20 || message.length > 2000) {
      setActionError('Proposal message must be 20 to 2000 characters.');
      return;
    }

    setBusyLeadId(lead.id);
    setActionError('');
    setNotice('');
    try {
      await submitOneTimeRequirementProposal({
        requirementId: lead.id,
        serviceId: lead.matching_service_id,
        amountMinor: Math.round(amount * 100),
        message,
      });
      setDraft(null);
      setNotice(`Proposal sent for ${lead.requirement_reference}.`);
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Proposal could not be submitted.');
    } finally {
      setBusyLeadId('');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}><BrandLogo compact /></View>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>PROVIDER</Text>
              <Text style={styles.title}>{providerType} leads</Text>
              <Text style={styles.description}>
                Respond to matching one-time Customer requirements from your Provider workspace.
              </Text>
            </View>
            <Pressable accessibilityRole="button" disabled={state.status === 'loading' || !!busyLeadId} onPress={() => setRefreshKey((value) => value + 1)} style={[styles.refreshButton, (state.status === 'loading' || !!busyLeadId) && styles.buttonDisabled]}>
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          <Link href="/provider-bookings" asChild>
            <Pressable accessibilityRole="button" style={styles.bookingEntry}>
              <View style={styles.bookingEntryCopy}>
                <Text style={styles.bookingEntryTitle}>Provider bookings</Text>
                <Text style={styles.bookingEntryText}>Review assigned service bookings and current journey status.</Text>
              </View>
              <Text style={styles.bookingEntryArrow}>→</Text>
            </Pressable>
          </Link>

          {notice ? <View style={styles.successCard}><Text style={styles.successText}>{notice}</Text></View> : null}
          {actionError ? <View style={styles.errorCard}><Text style={styles.errorText}>{actionError}</Text></View> : null}

          {state.status === 'loading' ? (
            <View style={styles.inlineStatus}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading matched requirements…</Text>
            </View>
          ) : null}
          {state.status === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.eyebrow}>MATCHED LEADS</Text>
              <Text style={styles.sectionTitle}>Customers looking now</Text>
            </View>
            <Text style={styles.count}>{state.marketplace.leads.length}</Text>
          </View>

          {state.status === 'ready' && state.marketplace.leads.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No matching leads right now</Text>
              <Text style={styles.muted}>New matching requirements will appear here automatically.</Text>
            </View>
          ) : null}

          {state.marketplace.leads.map((lead) => {
            const alreadyProposed = lead.already_proposed || proposedRequirementIds.has(lead.id);
            const draftOpen = draft?.leadId === lead.id;
            const busy = busyLeadId === lead.id;
            const recurring = lead.schedule_pattern === 'recurring';

            return (
              <View key={lead.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.reference}>{lead.requirement_reference}</Text>
                    <Text style={styles.cardTitle}>{lead.title}</Text>
                  </View>
                  <Text style={styles.openBadge}>OPEN</Text>
                </View>
                <Text style={styles.detail}>{lead.description}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{lead.category_name}</Text>
                  <Text style={styles.meta}>{lead.location_name}</Text>
                  <Text style={styles.meta}>{lead.service_mode}</Text>
                  <Text style={styles.meta}>{leadBudget(lead)}</Text>
                  <Text style={styles.meta}>{recurring ? 'Recurring' : 'One-time'}</Text>
                </View>

                {recurring ? (
                  <View style={styles.freezeCard}>
                    <Text style={styles.freezeTitle}>Recurring requirement</Text>
                    <Text style={styles.muted}>
                      Recurring proposal actions are available on the web for now.
                    </Text>
                  </View>
                ) : alreadyProposed ? (
                  <Text style={styles.alreadyText}>Proposal already submitted for this requirement.</Text>
                ) : !draftOpen ? (
                  <Pressable accessibilityRole="button" onPress={() => openDraft(lead)} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Respond with proposal</Text>
                  </Pressable>
                ) : (
                  <View style={styles.composer}>
                    <Text style={styles.composerTitle}>Proposal for {lead.requirement_reference}</Text>
                    <Text style={styles.label}>Amount ({lead.currency})</Text>
                    <TextInput
                      accessibilityLabel="Proposal amount"
                      value={draft.amount}
                      onChangeText={(amount) => setDraft((current) => current?.leadId === lead.id ? { ...current, amount } : current)}
                      keyboardType="decimal-pad"
                      placeholder="Enter quote"
                      style={styles.input}
                      editable={!busy}
                    />
                    <Text style={styles.label}>Message</Text>
                    <TextInput
                      accessibilityLabel="Proposal message"
                      value={draft.message}
                      onChangeText={(message) => setDraft((current) => current?.leadId === lead.id ? { ...current, message } : current)}
                      placeholder="Explain how you can help, scope and timing."
                      multiline
                      maxLength={2000}
                      textAlignVertical="top"
                      style={[styles.input, styles.messageInput]}
                      editable={!busy}
                    />
                    <Text style={styles.helper}>{draft.message.trim().length}/2000 · minimum 20 characters</Text>
                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => void submit(lead)}
                        style={[styles.primaryButton, busy && styles.buttonDisabled]}
                      >
                        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Send proposal</Text>}
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => setDraft(null)}
                        style={styles.secondaryButton}
                      >
                        <Text style={styles.secondaryButtonText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.eyebrow}>PROPOSAL HISTORY</Text>
              <Text style={styles.sectionTitle}>Your responses</Text>
            </View>
            <Text style={styles.count}>{state.marketplace.proposals.length}</Text>
          </View>

          {state.status === 'ready' && state.marketplace.proposals.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No proposal history yet</Text>
              <Text style={styles.muted}>Submitted proposals will remain visible here with their latest status.</Text>
            </View>
          ) : null}

          {state.marketplace.proposals.map((proposal) => <ProposalHistoryCard key={proposal.id} proposal={proposal} />)}
        </ScrollView>

        <MobileNav />
      </View>
    </SafeAreaView>
  );
}

function ProposalHistoryCard({ proposal }: { proposal: ProviderRequirementProposal }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.reference}>{proposal.proposal_reference}</Text>
          <Text style={styles.cardTitle}>{proposal.requirement_title}</Text>
        </View>
        
      </View>
      <Text style={styles.statusBadge}>{proposal.status}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{proposal.category_name}</Text>
        <Text style={styles.meta}>{proposal.location_name}</Text>
        <Text style={styles.meta}>{formatProviderLeadMoney(proposal.amount_minor, proposal.currency)}</Text>
      </View>
      <Text style={styles.detail}>{proposal.message}</Text>
      {proposal.status === 'accepted' && proposal.conversation_id ? (
        <Text style={styles.acceptedText}>Selected by Customer · conversation ready</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 },
  brandRow: { alignItems: 'center', paddingBottom: 6 },
  content: { gap: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: theme.colors.primary },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 20, color: theme.colors.inkMuted },
  refreshButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: theme.radii.md, backgroundColor: theme.colors.secondary },
  refreshText: { fontSize: 12, fontWeight: '900', color: theme.colors.primaryStrong },
  bookingEntry: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: theme.radii.lg, backgroundColor: theme.colors.primary, ...cardShadow },
  bookingEntryCopy: { flex: 1, minWidth: 0, gap: 3 },
  bookingEntryTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  bookingEntryText: { fontSize: 12, lineHeight: 17, color: '#dedee9' },
  bookingEntryArrow: { fontSize: 22, fontWeight: '800', color: '#fff' },
  successCard: { padding: 13, borderRadius: 12, backgroundColor: '#edf8ef' },
  successText: { fontSize: 13, fontWeight: '700', color: '#285c33' },
  errorCard: { padding: 13, borderRadius: 12, backgroundColor: '#fff0f0' },
  errorText: { fontSize: 13, lineHeight: 19, color: '#8b3535' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.ink },
  count: { minWidth: 34, textAlign: 'center', fontSize: 13, fontWeight: '900', color: theme.colors.white, backgroundColor: theme.colors.primary, paddingHorizontal: 9, paddingVertical: 7, borderRadius: theme.radii.pill },
  card: { gap: 10, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, ...cardShadow },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitleWrap: { flex: 1, minWidth: 0, gap: 3 },
  reference: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, color: theme.colors.inkMuted },
  cardTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.ink },
  openBadge: { fontSize: 10, fontWeight: '800', color: '#285c33', backgroundColor: '#edf8ef', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  statusBadge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: theme.colors.primaryStrong, backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  detail: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { fontSize: 11, color: theme.colors.inkMuted, backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  freezeCard: { padding: 13, borderRadius: 12, backgroundColor: '#fff8e7', gap: 5 },
  freezeTitle: { fontSize: 13, fontWeight: '800', color: '#66522b' },
  alreadyText: { fontSize: 12, fontWeight: '700', color: theme.colors.inkMuted },
  composer: { padding: 14, borderRadius: 14, backgroundColor: '#f7f7fb', gap: 8 },
  composerTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.ink },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.primaryStrong },
  input: { minHeight: 46, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.ink, backgroundColor: '#fff' },
  messageInput: { minHeight: 112 },
  helper: { fontSize: 11, color: theme.colors.inkMuted },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  primaryButton: { minHeight: 44, flexGrow: 1, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.md, backgroundColor: theme.colors.primary, paddingHorizontal: 14 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.md, backgroundColor: theme.colors.secondary, paddingHorizontal: 14 },
  secondaryButtonText: { color: theme.colors.primaryStrong, fontSize: 13, fontWeight: '900' },
  buttonDisabled: { opacity: 0.45 },
  acceptedText: { fontSize: 12, fontWeight: '800', color: '#285c33' },
  muted: { fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
});
