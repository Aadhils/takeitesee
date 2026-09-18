'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';
import { MarketplaceReportForm } from '../safety/MarketplaceReportForm';
import { RequirementJobPanel } from './RequirementJobPanel';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

type RequirementStatus = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
type PricingBasis = 'per_occurrence' | 'whole_requirement';
type RequirementRow = {
  id: string;
  requirement_reference: string;
  title: string;
  description: string;
  service_mode: string;
  budget_type: 'fixed' | 'range' | 'negotiable';
  budget_min_minor: number | null;
  budget_max_minor: number | null;
  currency: 'INR' | 'USD';
  needed_by: string | null;
  preferred_start_time: string | null;
  expected_duration_minutes: number | null;
  schedule_pattern: 'one_time' | 'recurring';
  recurrence_frequency: 'daily' | 'weekly' | 'monthly' | null;
  recurrence_interval: number | null;
  recurrence_count: number | null;
  recurrence_weekdays: number[] | null;
  status: RequirementStatus;
  published_at: string;
  closed_at: string | null;
  awarded_at: string | null;
  accepted_proposal_id: string | null;
  created_at: string;
  updated_at: string;
  platform_categories?: { name?: string | null } | Array<{ name?: string | null }> | null;
  platform_locations?: { name?: string | null } | Array<{ name?: string | null }> | null;
};
type RequirementEvent = { id: string; event_type: 'created' | 'status_changed'; from_status: string | null; to_status: string; created_at: string };
type Proposal = {
  id: string;
  proposal_reference: string;
  provider_display_name: string;
  provider_type: 'business' | 'professional';
  service_id: string;
  service_name: string;
  amount_minor: number;
  currency: 'INR' | 'USD';
  pricing_basis: PricingBasis;
  message: string;
  estimated_start_date: string | null;
  status: 'submitted' | 'withdrawn' | 'accepted' | 'declined';
  submitted_at: string;
  decided_at: string | null;
  provider_marketplace_status?: 'eligible' | 'ineligible' | 'unavailable';
  provider_profile_href?: string | null;
};

const WEEKDAY_NAMES = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ta: ['ஞாயி', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'],
} as const;

function relationName(value: RequirementRow['platform_categories'] | RequirementRow['platform_locations']) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name || '';
}
function formatMoney(minor: number, currency: 'INR' | 'USD', locale: string) {
  const hasMinorUnits = Math.abs(minor) % 100 !== 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: hasMinorUnits ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
function formatBudget(row: RequirementRow, locale: string, negotiableLabel: string) { if (row.budget_type === 'negotiable') return negotiableLabel; if (row.budget_type === 'fixed') return formatMoney(Number(row.budget_min_minor ?? 0), row.currency, locale); return `${formatMoney(Number(row.budget_min_minor ?? 0), row.currency, locale)} – ${formatMoney(Number(row.budget_max_minor ?? 0), row.currency, locale)}`; }
function tone(status: RequirementStatus) { if (status === 'open') return 'success' as const; if (status === 'paused') return 'warning' as const; if (status === 'awarded') return 'info' as const; if (status === 'fulfilled') return 'success' as const; return 'neutral' as const; }
function proposalTone(status: Proposal['status']) { if (status === 'accepted') return 'success' as const; if (status === 'submitted') return 'info' as const; if (status === 'declined') return 'danger' as const; return 'neutral' as const; }

export default function CustomerRequirementDetail({ requirementId }: { requirementId: string }) {
  const { locale, t, status } = useOperationalTranslations();
  const [requirement, setRequirement] = useState<RequirementRow | null>(null);
  const [events, setEvents] = useState<RequirementEvent[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposalBusyId, setProposalBusyId] = useState('');
  const [pendingAcceptId, setPendingAcceptId] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const tamil = locale.toLowerCase().startsWith('ta');
  const durationLabel = (minutes: number | null) => {
    if (minutes == null) return t('common.flexible');
    if (minutes % 1440 === 0) return `${minutes / 1440} ${tamil ? 'நாள்' : minutes === 1440 ? 'day' : 'days'}`;
    if (minutes % 60 === 0) return `${minutes / 60} ${tamil ? 'மணி' : minutes === 60 ? 'hour' : 'hours'}`;
    return `${minutes} ${tamil ? 'நிமிடம்' : 'min'}`;
  };
  const weekdayLabel = (values: number[] | null) => values?.length
    ? values.map((value) => (tamil ? WEEKDAY_NAMES.ta : WEEKDAY_NAMES.en)[value] ?? String(value)).join(', ')
    : '';
  const recurrenceLabel = (row: RequirementRow) => {
    if (row.schedule_pattern !== 'recurring' || !row.recurrence_frequency || !row.recurrence_interval || !row.recurrence_count) return tamil ? 'ஒருமுறை' : 'One-time';
    const unit = row.recurrence_frequency === 'daily' ? (tamil ? 'நாள்' : 'day') : row.recurrence_frequency === 'weekly' ? (tamil ? 'வாரம்' : 'week') : (tamil ? 'மாதம்' : 'month');
    const weekdays = row.recurrence_frequency === 'weekly' && row.recurrence_weekdays?.length ? ` · ${weekdayLabel(row.recurrence_weekdays)}` : '';
    return `${tamil ? 'ஒவ்வொரு' : 'Every'} ${row.recurrence_interval} ${unit}${!tamil && row.recurrence_interval !== 1 ? 's' : ''} × ${row.recurrence_count}${weekdays}`;
  };
  const pricingBasisLabel = (basis: PricingBasis) => basis === 'whole_requirement'
    ? (tamil ? 'முழு recurring requirement-க்கு மொத்த quote' : 'Total for the whole recurring requirement')
    : (tamil ? 'ஒவ்வொரு service occurrence-க்கும்' : 'Per service occurrence');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}`, { cache: 'no-store' });
      const payload = await response.json() as { requirement?: RequirementRow; events?: RequirementEvent[]; proposals?: Proposal[]; conversation_id?: string | null; error?: string };
      if (!response.ok || !payload.requirement) throw new Error(payload.error || 'Requirement could not be loaded.');
      setRequirement(payload.requirement);
      setEvents(payload.events ?? []);
      setProposals(payload.proposals ?? []);
      setConversationId(payload.conversation_id ?? null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Requirement could not be loaded.'); }
  }, [requirementId]);
  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (nextStatus: 'open' | 'paused' | 'fulfilled' | 'cancelled') => {
    if (!requirement || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || t('req.updateFailedFallback'));
      setNotice(`${t('req.marked')}: ${status(nextStatus)}.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('req.updateFailedFallback')); }
    finally { setBusy(false); }
  };

  const decideProposal = async (proposalId: string, decision: 'accept' | 'decline') => {
    if (proposalBusyId) return;
    setProposalBusyId(proposalId); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}/proposals/${encodeURIComponent(proposalId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || t('req.updateFailedFallback'));
      if (decision === 'accept') setPendingAcceptId('');
      setNotice(decision === 'accept' ? t('req.providerSelected') : t('req.proposalDeclined')); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('req.updateFailedFallback')); }
    finally { setProposalBusyId(''); }
  };

  const beginChooseAndSchedule = (proposalId: string) => {
    if (!requirement) return;
    setPendingAcceptId(proposalId);
    setScheduleDate(requirement.needed_by || '');
    setScheduleTime(requirement.preferred_start_time ? requirement.preferred_start_time.slice(0, 5) : '');
    setScheduleNotes('');
    setError('');
    setNotice('');
  };

  const chooseAndSchedule = async (proposalId: string) => {
    if (proposalBusyId) return;
    if (!scheduleDate || !scheduleTime) {
      setError(tamil ? 'Service date மற்றும் start time தேர்வு செய்யுங்கள்.' : 'Choose a service date and start time.');
      return;
    }
    setProposalBusyId(proposalId); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}/proposals/${encodeURIComponent(proposalId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'accept',
          booking_date: scheduleDate,
          start_time: scheduleTime,
          notes: scheduleNotes,
        }),
      });
      const payload = await response.json() as { booking?: { booking_reference?: string }; error?: string };
      if (!response.ok || !payload.booking) throw new Error(payload.error || (tamil ? 'Provider மற்றும் service time-ஐ உறுதி செய்ய முடியவில்லை.' : 'Provider and service time could not be confirmed.'));
      setPendingAcceptId('');
      setScheduleDate('');
      setScheduleTime('');
      setScheduleNotes('');
      setNotice(tamil
        ? `Provider தேர்வு செய்து service schedule உருவாக்கப்பட்டது${payload.booking.booking_reference ? `: ${payload.booking.booking_reference}` : ''}.`
        : `Provider chosen and service scheduled${payload.booking.booking_reference ? `: ${payload.booking.booking_reference}` : ''}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (tamil ? 'Provider மற்றும் service time-ஐ உறுதி செய்ய முடியவில்லை.' : 'Provider and service time could not be confirmed.'));
    } finally {
      setProposalBusyId('');
    }
  };

  if (!requirement) return <div style={{ display: 'grid', gap: '1rem' }}><Link href="/requirements">← {t('req.back')}</Link><Card><p>{error || t('common.loading')}</p></Card></div>;
  const categoryName = relationName(requirement.platform_categories);
  const locationName = relationName(requirement.platform_locations);
  const canReviewProposals = ['open', 'paused'].includes(requirement.status);
  const submittedProposals = proposals.filter((proposal) => proposal.status === 'submitted');
  const submittedProfessionalCount = submittedProposals.filter((proposal) => proposal.provider_type === 'professional').length;
  const submittedBusinessCount = submittedProposals.filter((proposal) => proposal.provider_type === 'business').length;
  const submittedPricingBases = new Set(submittedProposals.map((proposal) => proposal.pricing_basis || 'per_occurrence'));
  const quotesDirectlyComparable = submittedProposals.length > 1 && submittedPricingBases.size === 1;
  const lowestComparableQuote = quotesDirectlyComparable ? Math.min(...submittedProposals.map((proposal) => proposal.amount_minor)) : null;
  const orderedProposals = [...proposals].sort((left, right) => {
    const priority: Record<Proposal['status'], number> = { accepted: 0, submitted: 1, declined: 2, withdrawn: 3 };
    const statusDifference = priority[left.status] - priority[right.status];
    if (statusDifference !== 0) return statusDifference;
    return new Date(right.submitted_at).getTime() - new Date(left.submitted_at).getTime();
  });
  const acceptedProposal = proposals.find((proposal) => proposal.id === requirement.accepted_proposal_id || proposal.status === 'accepted') ?? null;
  const chatHref = conversationId ? `/messages?conversation=${encodeURIComponent(conversationId)}` : '/messages';
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const minimumScheduleDate = requirement.needed_by && requirement.needed_by > today ? requirement.needed_by : today;

  return <div style={{ display: 'grid', gap: '1rem' }}>
    <Link href="/requirements">← {t('req.back')}</Link>
    {error ? <Alert title={t('req.updateFailed')} tone="danger">{error}</Alert> : null}
    {notice ? <Alert title={t('req.updated')} tone="success">{notice}</Alert> : null}
    <Card className="policy-card">
      <div className="section-heading"><div><span className="eyebrow">{requirement.requirement_reference}</span><h1>{requirement.title}</h1></div><Badge tone={tone(requirement.status)}>{status(requirement.status)}</Badge></div>
      <p className="detail-copy">{requirement.description}</p>
      <dl className="review-details"><div><dt>{t('common.category')}</dt><dd>{categoryName || t('common.service')}</dd></div><div><dt>{t('common.location')}</dt><dd>{locationName || t('common.location')}</dd></div><div><dt>{t('req.serviceMode')}</dt><dd>{status(requirement.service_mode)}</dd></div><div><dt>{t('common.budget')}</dt><dd>{formatBudget(requirement, locale, t('req.negotiable'))}</dd></div><div><dt>{t('common.neededBy')}</dt><dd>{requirement.needed_by || t('common.flexible')}</dd></div><div><dt>{tamil ? 'விருப்பமான தொடக்க நேரம்' : 'Preferred start time'}</dt><dd>{requirement.preferred_start_time ? requirement.preferred_start_time.slice(0, 5) : t('common.flexible')}</dd></div><div><dt>{tamil ? 'எதிர்பார்க்கப்படும் கால அளவு' : 'Expected duration'}</dt><dd>{durationLabel(requirement.expected_duration_minutes)}</dd></div><div><dt>{tamil ? 'சேவை அட்டவணை' : 'Service schedule'}</dt><dd>{recurrenceLabel(requirement)}</dd></div>{requirement.recurrence_frequency === 'weekly' && requirement.recurrence_weekdays?.length ? <div><dt>{tamil ? 'வார நாட்கள்' : 'Weekdays'}</dt><dd>{weekdayLabel(requirement.recurrence_weekdays)}</dd></div> : null}<div><dt>{t('common.posted')}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(requirement.published_at))}</dd></div></dl>
      {['open','paused'].includes(requirement.status) ? <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>{requirement.status === 'open' ? <Button type="button" variant="quiet" loading={busy} onClick={() => void updateStatus('paused')}>{t('req.pauseNew')}</Button> : null}{requirement.status === 'paused' ? <Button type="button" variant="secondary" loading={busy} onClick={() => void updateStatus('open')}>{t('req.reopen')}</Button> : null}<Button type="button" variant="secondary" loading={busy} onClick={() => void updateStatus('fulfilled')}>{t('req.markFulfilled')}</Button><Button type="button" variant="danger" loading={busy} onClick={() => void updateStatus('cancelled')}>{t('common.cancel')}</Button></div> : requirement.status === 'awarded' ? <div style={{ display: 'grid', gap: '.65rem', marginTop: '1rem' }}><div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}><Link className="button button-primary" href={chatHref}>{t('req.openChat')}</Link><Button type="button" variant="danger" loading={busy} onClick={() => void updateStatus('cancelled')}>{t('req.cancelRequirement')}</Button></div><p className="summary-note">{t('req.awardedNote')}</p></div> : <p className="summary-note" style={{ marginTop: '1rem' }}>{t('req.closedNote')}</p>}
    </Card>

    {requirement.status === 'awarded' ? <Card className="policy-card">
      <div className="section-heading"><div><span className="eyebrow">{tamil ? 'MY SERVICE' : 'MY SERVICE'}</span><h2>{acceptedProposal ? `${acceptedProposal.service_name} · ${acceptedProposal.provider_display_name}` : (tamil ? 'உங்கள் service journey' : 'Your service journey')}</h2></div><Badge tone="success">{tamil ? 'Provider தேர்வு முடிந்தது' : 'Provider chosen'}</Badge></div>
      <p className="detail-copy">{tamil ? 'Provider தேர்வு முடிந்தது. இதே journey-ல் service time, chat, booking மற்றும் completion அனைத்தையும் தொடரலாம் — வேறு workflow நினைவில் வைத்துக்கொள்ள வேண்டாம்.' : 'Your provider is chosen. Continue the service time, chat, booking and completion from this same journey — no separate workflow to remember.'}</p>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.75rem' }}>
        <Link className="button button-primary" href="#requirement-service-job">{tamil ? 'Service journey தொடரு' : 'Continue service journey'}</Link>
        <Link className="button button-secondary" href={chatHref}>{tamil ? 'Provider-க்கு message செய்' : 'Message provider'}</Link>
      </div>
    </Card> : null}

    <Card className="policy-card">
      <div className="section-heading"><div><span className="eyebrow">{t('req.providerProposals')}</span><h2>{t('req.compareProviders')}</h2></div><Badge tone="info">{proposals.length}</Badge></div>
      {submittedProposals.length > 0 && canReviewProposals ? <div className="customer-proposal-compare-guide">
        <strong>{tamil ? 'Compare செய்து, ஒரே step-ல் Provider + time தேர்வு செய்யுங்கள்' : 'Compare, then choose your provider and time in one step'}</strong>
        <p>{tamil ? 'Provider profile, service, quote மற்றும் message-ஐ பார்த்து முடிவு செய்யுங்கள். “Choose & schedule” மூலம் Provider selection மற்றும் முதல் service booking ஒரே confirmation-ல் முடியும்.' : 'Review the provider profile, service, quote and message. “Choose & schedule” completes provider selection and the first service booking in one confirmation.'}</p>
        <div className="customer-proposal-compare-badges"><Badge tone="info">{submittedProposals.length} {tamil ? 'active proposals' : 'active proposals'}</Badge>{submittedProfessionalCount > 0 ? <Badge tone="neutral">{submittedProfessionalCount} {tamil ? 'Professional' : submittedProfessionalCount === 1 ? 'Professional' : 'Professionals'}</Badge> : null}{submittedBusinessCount > 0 ? <Badge tone="neutral">{submittedBusinessCount} {tamil ? 'Business' : submittedBusinessCount === 1 ? 'Business' : 'Businesses'}</Badge> : null}</div>
        {submittedPricingBases.size > 1 ? <p className="summary-note">{tamil ? 'கவனம்: சில recurring proposals per-occurrence quote, சில whole-requirement quote. இந்த amounts-ஐ நேரடியாக cheapest என்று compare செய்ய வேண்டாம்.' : 'Note: these recurring proposals use different quote bases. Per-occurrence and whole-requirement amounts are not directly comparable.'}</p> : null}
      </div> : null}
      {proposals.length === 0 ? <p className="detail-copy">{t('req.noProposals')}</p> : <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        {orderedProposals.map((proposal) => {
          const pendingAccept = pendingAcceptId === proposal.id && proposal.status === 'submitted' && canReviewProposals;
          const lowestComparable = lowestComparableQuote != null && proposal.status === 'submitted' && proposal.amount_minor === lowestComparableQuote;
          const marketplaceStatus = proposal.provider_marketplace_status ?? 'unavailable';
          const currentlyIneligible = marketplaceStatus === 'ineligible';
          return <div key={proposal.id} className={`customer-proposal-card${pendingAccept ? ' customer-proposal-card-selected' : ''}`}>
          <div className="section-heading"><div><span className="eyebrow">{proposal.proposal_reference}</span><h3>{proposal.provider_display_name}</h3><p className="summary-note">{status(proposal.provider_type)} · {proposal.service_name}</p></div><div className="customer-proposal-statuses">{lowestComparable ? <Badge tone="success">{tamil ? 'குறைந்த comparable quote' : 'Lowest comparable quote'}</Badge> : null}{marketplaceStatus === 'eligible' ? <Badge tone="success">{tamil ? 'Marketplace eligible' : 'Marketplace eligible now'}</Badge> : marketplaceStatus === 'ineligible' ? <Badge tone="warning">{tamil ? 'தற்போது unavailable' : 'Currently unavailable'}</Badge> : <Badge tone="neutral">{tamil ? 'Eligibility check unavailable' : 'Eligibility check unavailable'}</Badge>}<Badge tone={proposalTone(proposal.status)}>{status(proposal.status)}</Badge></div></div>
          <dl className="review-details"><div><dt>{tamil ? 'Provider identity' : 'Provider identity'}</dt><dd>{status(proposal.provider_type)}</dd></div><div><dt>{t('common.quote')}</dt><dd>{formatMoney(proposal.amount_minor, proposal.currency, locale)}</dd></div><div><dt>{tamil ? 'Quote basis' : 'Quote basis'}</dt><dd>{pricingBasisLabel(proposal.pricing_basis || 'per_occurrence')}</dd></div><div><dt>{t('common.estimatedStart')}</dt><dd>{proposal.estimated_start_date || t('common.flexible')}</dd></div><div><dt>{t('common.submitted')}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(proposal.submitted_at))}</dd></div></dl>
          <div className={`customer-provider-current-context customer-provider-current-context-${marketplaceStatus}`}>
            <div><strong>{tamil ? 'Current Provider status' : 'Current provider status'}</strong><p>{marketplaceStatus === 'eligible' ? (tamil ? 'இந்த proposal-ன் service தற்போது public marketplace eligibility checks-ஐ pass செய்கிறது.' : 'This proposal service currently passes the public marketplace eligibility checks.') : marketplaceStatus === 'ineligible' ? (tamil ? 'இந்த Provider/service தற்போது புதிய marketplace work-க்கு eligible இல்லை. காரணமான private trust/moderation details இங்கே காட்டப்படாது.' : 'This provider/service is not currently eligible for new marketplace work. Private trust or moderation details are not disclosed here.') : (tamil ? 'Current public eligibility-ஐ இப்போது verify செய்ய முடியவில்லை. Final selection server-side மீண்டும் verify செய்யப்படும்.' : 'Current public eligibility could not be verified right now. Final selection will recheck eligibility on the server.')}</p></div>
            {proposal.provider_profile_href ? <Link className="button button-secondary" href={proposal.provider_profile_href}>{tamil ? 'Public profile பார்க்க' : 'View public profile'}</Link> : null}
          </div>
          <div className="customer-proposal-message"><span className="eyebrow">{tamil ? 'Provider message' : 'Provider message'}</span><p className="detail-copy">{proposal.message}</p></div>
          {pendingAccept ? <div className="customer-proposal-confirm customer-proposal-smart-schedule" role="region" aria-label={tamil ? 'Provider மற்றும் service time உறுதி' : 'Choose provider and service time'}>
            <strong>{tamil ? `${proposal.provider_display_name} உடன் service-ஐ schedule செய்யவா?` : `Choose & schedule with ${proposal.provider_display_name}`}</strong>
            <p>{tamil ? 'இந்த ஒரே confirmation Provider-ஐ தேர்வு செய்து முதல் service booking-ஐ உருவாக்கும். மற்ற submitted proposals decline ஆகும். Payment இப்போது தொடங்காது; eligibility மற்றும் availability server-side மீண்டும் verify செய்யப்படும்.' : 'One confirmation chooses the provider and creates the first service booking. Other submitted proposals are declined. No payment starts now; eligibility and availability are rechecked on the server.'}</p>
            <dl className="review-details"><div><dt>{tamil ? 'Provider' : 'Provider'}</dt><dd>{proposal.provider_display_name} · {status(proposal.provider_type)}</dd></div><div><dt>{t('common.service')}</dt><dd>{proposal.service_name}</dd></div><div><dt>{t('common.quote')}</dt><dd>{formatMoney(proposal.amount_minor, proposal.currency, locale)}</dd></div><div><dt>{tamil ? 'Quote basis' : 'Quote basis'}</dt><dd>{pricingBasisLabel(proposal.pricing_basis || 'per_occurrence')}</dd></div></dl>
            <div className="customer-smart-schedule-grid">
              <label className="field"><span className="field-label">{tamil ? 'Service date' : 'Service date'}</span><input className="field-control" type="date" min={minimumScheduleDate} value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} required /></label>
              <label className="field"><span className="field-label">{tamil ? 'Start time' : 'Start time'}</span><input className="field-control" type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} required /></label>
            </div>
            <label className="field"><span className="field-label">{tamil ? 'Service note (optional)' : 'Service note (optional)'}</span><textarea className="field-control field-textarea" rows={2} maxLength={1000} value={scheduleNotes} onChange={(event) => setScheduleNotes(event.target.value)} placeholder={tamil ? 'Chat-ல் ஒப்புக்கொண்ட access/details இருந்தால் சேர்க்கவும்.' : 'Add access details or anything already agreed in chat.'} /></label>
            <p className="summary-note">{tamil ? 'Time unavailable என்றால் Provider selection save ஆகாது; வேறு time தேர்வு செய்து மீண்டும் try செய்யலாம்.' : 'If the time is unavailable, the provider selection is not saved. Choose another time and try again.'}</p>
            <div className="customer-proposal-confirm-actions">
              <Button type="button" loading={proposalBusyId === proposal.id} disabled={currentlyIneligible || !scheduleDate || !scheduleTime} onClick={() => void chooseAndSchedule(proposal.id)}>{tamil ? 'Provider + time உறுதி செய்' : 'Confirm provider & time'}</Button>
              <Button type="button" variant="secondary" loading={proposalBusyId === proposal.id} disabled={currentlyIneligible} onClick={() => void decideProposal(proposal.id, 'accept')}>{tamil ? 'Time பின்னர் தேர்வு செய்' : 'Choose time later'}</Button>
              <Button type="button" variant="quiet" disabled={proposalBusyId === proposal.id} onClick={() => setPendingAcceptId('')}>{tamil ? 'Compare செய்ய திரும்பு' : 'Keep comparing'}</Button>
            </div>
          </div> : null}
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'start' }}>{proposal.status === 'submitted' && canReviewProposals && !pendingAccept && !currentlyIneligible ? <><Button type="button" loading={proposalBusyId === proposal.id} onClick={() => beginChooseAndSchedule(proposal.id)}>{tamil ? 'Choose & schedule' : 'Choose & schedule'}</Button><Button type="button" variant="quiet" loading={proposalBusyId === proposal.id} onClick={() => void decideProposal(proposal.id, 'decline')}>{t('req.decline')}</Button></> : proposal.status === 'submitted' && canReviewProposals && !pendingAccept ? <Button type="button" variant="quiet" loading={proposalBusyId === proposal.id} onClick={() => void decideProposal(proposal.id, 'decline')}>{t('req.decline')}</Button> : null}<MarketplaceReportForm targetType="proposal" targetId={proposal.id} label={t('req.reportProposal')} /></div>
          {proposal.status === 'accepted' ? <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '.6rem' }}><Link className="button button-secondary" href={chatHref}>{t('req.openChat')}</Link><p className="summary-note">{t('req.privateOnly')}</p></div> : null}
        </div>; })}
      </div>}
    </Card>

    {requirement.status === 'awarded' || requirement.status === 'fulfilled' ? <div id="requirement-service-job" style={{ scrollMarginTop: '120px' }}><RequirementJobPanel requirementId={requirementId} requirementStatus={requirement.status} conversationId={conversationId} /></div> : null}
    <Card className="policy-card"><span className="eyebrow">{t('req.auditHistory')}</span><h2>{t('req.lifecycle')}</h2><div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>{events.map((event) => <div key={event.id} style={{ borderBottom: '1px solid #ececf2', paddingBottom: '.75rem' }}><strong>{event.event_type === 'created' ? t('req.postedEvent') : `${t('req.statusChanged')} ${status(event.to_status)}`}</strong><p className="summary-note">{event.from_status ? `${status(event.from_status)} → ${status(event.to_status)} · ` : ''}{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.created_at))}</p></div>)}</div></Card>
    <style jsx global>{`
      .customer-proposal-compare-guide { display: grid; gap: .55rem; margin-top: 1rem; padding: .9rem 1rem; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface-muted); }
      .customer-proposal-compare-guide p { margin: 0; }
      .customer-proposal-compare-badges, .customer-proposal-statuses { display: flex; gap: .45rem; flex-wrap: wrap; align-items: center; }
      .customer-proposal-statuses { justify-content: flex-end; }
      .customer-proposal-card { border: 1px solid var(--color-border); border-radius: 16px; padding: 1rem; }
      .customer-proposal-card-selected { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-selected); }
      .customer-provider-current-context { display: flex; justify-content: space-between; gap: .75rem; align-items: center; margin-top: .85rem; padding: .8rem .9rem; border: 1px solid var(--color-border); border-radius: 12px; }
      .customer-provider-current-context p { margin: .25rem 0 0; font-size: .88rem; color: var(--color-text-muted); }
      .customer-provider-current-context-ineligible { border-color: var(--color-warning); }
      .customer-provider-current-context-unavailable { background: var(--color-surface-muted); }
      .customer-proposal-message { margin: .85rem 0; padding: .8rem .9rem; border-radius: 12px; background: var(--color-surface-muted); }
      .customer-proposal-message p { margin: .35rem 0 0; }
      .customer-proposal-confirm { display: grid; gap: .75rem; margin: 1rem 0; padding: 1rem; border: 1px solid var(--color-primary); border-radius: 14px; background: var(--color-selected); }
      .customer-proposal-confirm > p { margin: 0; }
      .customer-proposal-confirm-actions { display: flex; gap: .6rem; flex-wrap: wrap; }
      .customer-smart-schedule-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
      .customer-proposal-smart-schedule .field-textarea { min-height: 84px; }
      @media (max-width: 720px) {
        .customer-provider-current-context { align-items: flex-start; flex-direction: column; }
        .customer-smart-schedule-grid { grid-template-columns: 1fr; }
        .customer-proposal-confirm-actions { display: grid; grid-template-columns: 1fr; }
        .customer-proposal-confirm-actions .button { width: 100%; }
      }
    `}</style>
  </div>;
}
