'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';
import { MarketplaceReportForm } from '../safety/MarketplaceReportForm';
import { LiveProviderShell } from './LiveProviderShell';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

type PricingBasis = 'per_occurrence' | 'whole_requirement';
type Lead = {
  id: string; requirement_reference: string; title: string; description: string; service_mode: string;
  budget_type: 'fixed' | 'range' | 'negotiable'; budget_min_minor: number | null; budget_max_minor: number | null;
  currency: 'INR' | 'USD'; needed_by: string | null; preferred_start_time: string | null; expected_duration_minutes: number | null;
  schedule_pattern: 'one_time' | 'recurring'; recurrence_frequency: 'daily' | 'weekly' | 'monthly' | null; recurrence_interval: number | null; recurrence_count: number | null; recurrence_weekdays: number[] | null;
  published_at: string; category_name: string; location_name: string; matching_service_id: string; already_proposed: boolean;
};
type Proposal = {
  id: string; proposal_reference: string; requirement_id: string; service_id: string; amount_minor: number; currency: 'INR' | 'USD'; pricing_basis: PricingBasis;
  message: string; estimated_start_date: string | null; status: 'submitted' | 'withdrawn' | 'accepted' | 'declined'; submitted_at: string;
  decided_at: string | null; requirement_reference: string; requirement_title: string; requirement_status: string; category_name: string; location_name: string;
};
type Marketplace = { leads: Lead[]; proposals: Proposal[] };
type Draft = { amount: string; pricingBasis: PricingBasis; message: string; estimatedStartDate: string };
const emptyDraft: Draft = { amount: '', pricingBasis: 'per_occurrence', message: '', estimatedStartDate: '' };
const WEEKDAY_NAMES = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ta: ['ஞாயி', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'],
} as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function proposalTone(status: Proposal['status']) { if (status === 'accepted') return 'success' as const; if (status === 'submitted') return 'info' as const; if (status === 'declined') return 'danger' as const; return 'neutral' as const; }
function initialDraftForLead(lead: Lead): Draft {
  const amount = lead.budget_type === 'fixed' && lead.budget_min_minor != null && lead.budget_min_minor > 0
    ? String(lead.budget_min_minor / 100)
    : '';
  return { ...emptyDraft, amount };
}

export function ProviderRequirementLeadsManager() {
  const { locale, t, status } = useOperationalTranslations();
  const [marketplace, setMarketplace] = useState<Marketplace>({ leads: [], proposals: [] });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [expandedProposalIds, setExpandedProposalIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [targetRequirementId, setTargetRequirementId] = useState('');
  const [targetProposalId, setTargetProposalId] = useState('');
  const [focusedRequirementId, setFocusedRequirementId] = useState('');
  const [focusedProposalId, setFocusedProposalId] = useState('');
  const [targetMissing, setTargetMissing] = useState(false);
  const focusFrameRef = useRef<number | null>(null);

  const tamil = locale.toLowerCase().startsWith('ta');
  const money = (minor: number | null, currency: 'INR' | 'USD') => { if (minor == null) return ''; return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100); };
  const leadBudget = (lead: Lead) => { if (lead.budget_type === 'negotiable') return t('req.negotiable'); if (lead.budget_type === 'fixed') return money(lead.budget_min_minor, lead.currency); return `${money(lead.budget_min_minor, lead.currency)} – ${money(lead.budget_max_minor, lead.currency)}`; };
  const modeLabel = (value: string) => value === 'onsite' ? t('req.onsite') : value === 'remote' ? t('req.remote') : value === 'either' ? t('req.either') : value;
  const durationLabel = (minutes: number | null) => {
    if (minutes == null) return t('common.flexible');
    if (minutes % 1440 === 0) return `${minutes / 1440} ${tamil ? 'நாள்' : minutes === 1440 ? 'day' : 'days'}`;
    if (minutes % 60 === 0) return `${minutes / 60} ${tamil ? 'மணி' : minutes === 60 ? 'hour' : 'hours'}`;
    return `${minutes} ${tamil ? 'நிமிடம்' : 'min'}`;
  };
  const startTimeLabel = (value: string | null) => value ? value.slice(0, 5) : t('common.flexible');
  const weekdayLabel = (values: number[] | null) => values?.length
    ? values.map((value) => (tamil ? WEEKDAY_NAMES.ta : WEEKDAY_NAMES.en)[value] ?? String(value)).join(', ')
    : '';
  const recurrenceLabel = (lead: Lead) => {
    if (lead.schedule_pattern !== 'recurring' || !lead.recurrence_frequency || !lead.recurrence_interval || !lead.recurrence_count) return tamil ? 'ஒருமுறை' : 'One-time';
    const unit = lead.recurrence_frequency === 'daily' ? (tamil ? 'நாள்' : 'day') : lead.recurrence_frequency === 'weekly' ? (tamil ? 'வாரம்' : 'week') : (tamil ? 'மாதம்' : 'month');
    const weekdays = lead.recurrence_frequency === 'weekly' && lead.recurrence_weekdays?.length ? ` · ${weekdayLabel(lead.recurrence_weekdays)}` : '';
    return `${tamil ? 'ஒவ்வொரு' : 'Every'} ${lead.recurrence_interval} ${unit}${!tamil && lead.recurrence_interval !== 1 ? 's' : ''} × ${lead.recurrence_count}${weekdays}`;
  };
  const pricingBasisLabel = (basis: PricingBasis) => basis === 'whole_requirement'
    ? (tamil ? 'முழு recurring requirement-க்கு மொத்த quote' : 'Total for the whole recurring requirement')
    : (tamil ? 'ஒவ்வொரு service occurrence-க்கும்' : 'Per service occurrence');
  const starterMessage = (lead: Lead) => tamil
    ? `இந்த ${lead.category_name} requirement-ஐ ${lead.location_name} பகுதியில் செய்ய உதவ முடியும். என் quote கேட்ட service-க்கு பொருந்தும்; தேவையான விவரங்களை chat-ல் உறுதி செய்யலாம்.`
    : `I can help with this ${lead.category_name} requirement in ${lead.location_name}. My quote covers the requested service, and we can confirm the remaining details in chat.`;

  const markLeadNotificationsSeen = useCallback(() => {
    void fetch('/api/provider/requirement-leads', { method: 'PATCH', cache: 'no-store' })
      .then((response) => {
        if (response.ok) window.dispatchEvent(new Event('provider-leads-seen'));
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/provider/requirement-leads', { cache: 'no-store' });
      const payload = await response.json() as { marketplace?: Marketplace; error?: string };
      if (!response.ok || !payload.marketplace) throw new Error(payload.error || 'Provider leads could not be loaded.');
      setMarketplace({ leads: payload.marketplace.leads ?? [], proposals: payload.marketplace.proposals ?? [] });
      markLeadNotificationsSeen();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Provider leads could not be loaded.'); } finally { setLoading(false); }
  }, [markLeadNotificationsSeen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedRequirement = params.get('requirement')?.trim() ?? '';
    const requestedProposal = params.get('proposal')?.trim() ?? '';
    if (UUID_PATTERN.test(requestedRequirement)) setTargetRequirementId(requestedRequirement);
    if (UUID_PATTERN.test(requestedProposal)) setTargetProposalId(requestedProposal);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (loading || !targetRequirementId) return;

    const focusTarget = (elementId: string) => {
      if (focusFrameRef.current != null) window.cancelAnimationFrame(focusFrameRef.current);
      focusFrameRef.current = window.requestAnimationFrame(() => {
        const target = document.getElementById(elementId);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target?.focus({ preventScroll: true });
        focusFrameRef.current = null;
      });
      return () => {
        if (focusFrameRef.current != null) {
          window.cancelAnimationFrame(focusFrameRef.current);
          focusFrameRef.current = null;
        }
      };
    };

    const leadMatch = marketplace.leads.find((lead) => lead.id === targetRequirementId);
    const proposalMatch = targetProposalId
      ? marketplace.proposals.find((proposal) => proposal.id === targetProposalId && proposal.requirement_id === targetRequirementId)
      : marketplace.proposals.find((proposal) => proposal.requirement_id === targetRequirementId);

    if (!leadMatch && proposalMatch) {
      setTargetMissing(false);
      setFocusedRequirementId('');
      setFocusedProposalId(proposalMatch.id);
      return focusTarget(`provider-proposal-history-${proposalMatch.id}`);
    }

    if (!leadMatch) {
      setFocusedRequirementId('');
      setFocusedProposalId('');
      setTargetMissing(true);
      return;
    }

    setTargetMissing(false);
    setFocusedProposalId('');
    setFocusedRequirementId(targetRequirementId);
    if (!leadMatch.already_proposed) {
      setExpandedProposalIds((current) => current[targetRequirementId] ? current : { ...current, [targetRequirementId]: true });
      setDrafts((current) => current[targetRequirementId] ? current : { ...current, [targetRequirementId]: initialDraftForLead(leadMatch) });
    }
    return focusTarget(`provider-lead-${targetRequirementId}`);
  }, [loading, marketplace.leads, marketplace.proposals, targetProposalId, targetRequirementId]);

  const submittedRequirementIds = useMemo(() => new Set(marketplace.proposals.map((p) => p.requirement_id)), [marketplace.proposals]);
  const updateDraft = (leadId: string, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [leadId]: { ...(current[leadId] ?? emptyDraft), ...patch } }));
  const openProposal = (lead: Lead) => {
    setExpandedProposalIds((current) => ({ ...current, [lead.id]: true }));
    setDrafts((current) => current[lead.id] ? current : { ...current, [lead.id]: initialDraftForLead(lead) });
  };
  const closeProposal = (leadId: string) => setExpandedProposalIds((current) => ({ ...current, [leadId]: false }));

  const submitProposal = async (lead: Lead) => {
    const draft = drafts[lead.id] ?? emptyDraft; const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0 || draft.message.trim().length < 20 || busyId) return;
    setBusyId(lead.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/provider/requirement-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirement_id: lead.id, service_id: lead.matching_service_id, amount_minor: Math.round(amount * 100), pricing_basis: lead.schedule_pattern === 'recurring' ? draft.pricingBasis : 'per_occurrence', message: draft.message, estimated_start_date: draft.estimatedStartDate || null }) });
      const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || 'Proposal could not be submitted.');
      setNotice(`${t('lead.sentFor')} ${lead.requirement_reference}.`); setDrafts((current) => ({ ...current, [lead.id]: emptyDraft })); setExpandedProposalIds((current) => ({ ...current, [lead.id]: false })); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Proposal could not be submitted.'); } finally { setBusyId(''); }
  };

  const withdrawProposal = async (proposal: Proposal) => {
    if (busyId) return; setBusyId(proposal.id); setError(''); setNotice('');
    try { const response = await fetch(`/api/provider/requirement-proposals/${encodeURIComponent(proposal.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'withdraw' }) }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || 'Proposal could not be withdrawn.'); setNotice(`${proposal.proposal_reference} ${t('lead.withdrawn')}`); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Proposal could not be withdrawn.'); } finally { setBusyId(''); }
  };

  return <LiveProviderShell active="/provider/leads"><div style={{ display: 'grid', gap: '1.25rem' }}>
    <section><span className="eyebrow">{t('lead.marketplace')}</span><h1>{t('lead.title')}</h1><p className="detail-copy">{t('lead.intro')}</p></section>
    {error ? <Alert title={t('lead.unavailable')} tone="danger">{error}</Alert> : null}{notice ? <Alert title={t('lead.proposalUpdate')} tone="success">{notice}</Alert> : null}
    {targetMissing ? <Alert title={tamil ? 'இந்த Lead தற்போது கிடைக்கவில்லை' : 'This lead is no longer available'} tone="warning">{tamil ? 'இந்த requirement closed, awarded அல்லது இனி உங்கள் matching service-க்கு eligible இல்லாமல் இருக்கலாம். மற்ற புதிய matching leads கீழே இருக்கின்றன.' : 'This requirement may have closed, been awarded, or no longer match your eligible service. Other current matching leads are shown below.'}</Alert> : null}
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div className="section-heading"><div><span className="eyebrow">{t('lead.matched')}</span><h2>{t('lead.customersLooking')}</h2></div><Badge tone="info">{marketplace.leads.length}</Badge></div>
      {loading ? <Card><p>{t('lead.loading')}</p></Card> : null}{!loading && marketplace.leads.length === 0 ? <Card><p>{t('lead.none')}</p></Card> : null}
      {marketplace.leads.map((lead) => { const draft = drafts[lead.id] ?? emptyDraft; const alreadyProposed = lead.already_proposed || submittedRequirementIds.has(lead.id); const targeted = focusedRequirementId === lead.id; const proposalOpen = Boolean(expandedProposalIds[lead.id]); return <Card id={`provider-lead-${lead.id}`} tabIndex={targeted ? -1 : undefined} className={`policy-card${targeted ? ' provider-targeted-lead' : ''}`} key={lead.id}>
        <div className="section-heading"><div><span className="eyebrow">{lead.requirement_reference}</span><h3>{lead.title}</h3></div><div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{targeted ? <Badge tone="info">{tamil ? 'புதிய Lead' : 'New lead'}</Badge> : null}<Badge tone="success">{t('common.open')}</Badge></div></div><p className="detail-copy">{lead.description}</p>
        <dl className="review-details"><div><dt>{t('common.category')}</dt><dd>{lead.category_name}</dd></div><div><dt>{t('common.location')}</dt><dd>{lead.location_name}</dd></div><div><dt>{t('common.mode')}</dt><dd>{modeLabel(lead.service_mode)}</dd></div><div><dt>{t('lead.customerBudget')}</dt><dd>{leadBudget(lead)}</dd></div><div><dt>{t('common.neededBy')}</dt><dd>{lead.needed_by || t('common.flexible')}</dd></div><div><dt>{tamil ? 'விருப்பமான தொடக்க நேரம்' : 'Preferred start time'}</dt><dd>{startTimeLabel(lead.preferred_start_time)}</dd></div><div><dt>{tamil ? 'எதிர்பார்க்கப்படும் கால அளவு' : 'Expected duration'}</dt><dd>{durationLabel(lead.expected_duration_minutes)}</dd></div><div><dt>{tamil ? 'சேவை அட்டவணை' : 'Service schedule'}</dt><dd>{recurrenceLabel(lead)}</dd></div>{lead.recurrence_frequency === 'weekly' && lead.recurrence_weekdays?.length ? <div><dt>{tamil ? 'வார நாட்கள்' : 'Weekdays'}</dt><dd>{weekdayLabel(lead.recurrence_weekdays)}</dd></div> : null}<div><dt>{t('common.posted')}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(lead.published_at))}</dd></div></dl>
        <div className="provider-lead-match-context">
          <strong>{tamil ? 'இந்த Lead உங்களுக்கு ஏன் match ஆனது?' : 'Why this lead matches you'}</strong>
          <p>{tamil ? `உங்கள் active eligible service ${lead.category_name} category-யும் ${lead.location_name} location-யும் match செய்கிறது; ${modeLabel(lead.service_mode)} service mode-க்கும் பொருந்துகிறது.` : `Your active eligible service matches the ${lead.category_name} category in ${lead.location_name}, and its fulfillment options support ${modeLabel(lead.service_mode)} work.`}</p>
          <div className="provider-lead-match-badges"><Badge tone="info">{tamil ? 'Category match' : 'Category match'}</Badge><Badge tone="info">{tamil ? 'Location match' : 'Location match'}</Badge><Badge tone="success">{modeLabel(lead.service_mode)} {tamil ? 'compatible' : 'compatible'}</Badge></div>
        </div>
        {alreadyProposed ? <p className="summary-note" style={{ marginTop: '1rem' }}>{t('lead.already')}</p> : proposalOpen ? <div id={`provider-proposal-${lead.id}`} className="provider-lead-proposal" style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
          {lead.budget_type === 'fixed' && lead.budget_min_minor != null && lead.budget_min_minor > 0 ? <p className="summary-note">{tamil ? 'Customer fixed budget உங்கள் quote-ல் editable starting amount ஆக முன்பே நிரப்பப்பட்டுள்ளது.' : 'The customer fixed budget is prefilled as an editable starting quote.'}</p> : null}
          <label className="field"><span className="field-label">{t('lead.yourQuote')} ({lead.currency})</span><input className="field-control" type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => updateDraft(lead.id, { amount: event.target.value })} placeholder="1200" /></label>
          {lead.schedule_pattern === 'recurring' ? <label className="field"><span className="field-label">{tamil ? 'Quote எதற்காக?' : 'What does this quote cover?'}</span><select className="field-control" value={draft.pricingBasis} onChange={(event) => updateDraft(lead.id, { pricingBasis: event.target.value as PricingBasis })}><option value="per_occurrence">{pricingBasisLabel('per_occurrence')}</option><option value="whole_requirement">{pricingBasisLabel('whole_requirement')}</option></select></label> : <p className="summary-note">{pricingBasisLabel('per_occurrence')}</p>}
          <label className="field"><span className="field-label">{t('lead.proposalMessage')}</span><textarea className="field-control field-textarea" rows={4} minLength={20} maxLength={2000} value={draft.message} onChange={(event) => updateDraft(lead.id, { message: event.target.value })} placeholder={t('lead.proposalPlaceholder')} /></label>
          <div className="provider-proposal-helper"><Button type="button" variant="quiet" onClick={() => updateDraft(lead.id, { message: starterMessage(lead) })}>{tamil ? 'Starter message பயன்படுத்து' : 'Use starter message'}</Button><span>{tamil ? 'அனுப்பும் முன் amount மற்றும் message இரண்டையும் review செய்யவும்.' : 'Review the amount and message before sending.'}</span></div>
          <label className="field"><span className="field-label">{t('lead.startOptional')}</span><input className="field-control" type="date" min={new Date().toISOString().slice(0, 10)} value={draft.estimatedStartDate} onChange={(event) => updateDraft(lead.id, { estimatedStartDate: event.target.value })} /></label><div className="provider-proposal-actions"><Button type="button" loading={busyId === lead.id} disabled={!draft.amount || draft.message.trim().length < 20} onClick={() => void submitProposal(lead)}>{t('lead.send')}</Button><Button type="button" variant="quiet" disabled={busyId === lead.id} onClick={() => closeProposal(lead.id)}>{tamil ? 'பின்னர்' : 'Not now'}</Button></div></div> : <div className="provider-lead-response-cta"><Button type="button" aria-expanded={false} aria-controls={`provider-proposal-${lead.id}`} onClick={() => openProposal(lead)}>{tamil ? 'இந்த Lead-க்கு பதில் அளிக்க' : 'Respond to this lead'}</Button><span>{tamil ? 'Quote மற்றும் message அனுப்பி Customer-க்கு proposal கொடுக்கலாம்.' : 'Send a quote and message to propose your service to the customer.'}</span></div>}
      </Card>; })}
    </section>
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div className="section-heading"><div><span className="eyebrow">{t('lead.myProposals')}</span><h2>{t('lead.track')}</h2></div><Badge tone="neutral">{marketplace.proposals.length}</Badge></div>
      {marketplace.proposals.length === 0 ? <Card><p>{t('lead.noneSubmitted')}</p></Card> : marketplace.proposals.map((proposal) => {
        const targeted = focusedProposalId === proposal.id;
        return <Card id={`provider-proposal-history-${proposal.id}`} tabIndex={targeted ? -1 : undefined} className={`policy-card${targeted ? ' provider-targeted-proposal' : ''}`} key={proposal.id}>
          <div className="section-heading"><div><span className="eyebrow">{proposal.proposal_reference}</span><h3>{proposal.requirement_title}</h3></div><div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{targeted && proposal.status === 'accepted' ? <Badge tone="success">{tamil ? 'Customer உங்களை தேர்வு செய்தார்' : 'Customer selected you'}</Badge> : null}<Badge tone={proposalTone(proposal.status)}>{status(proposal.status)}</Badge></div></div>
          {targeted && proposal.status === 'accepted' ? <Alert title={tamil ? 'உங்கள் proposal ஏற்கப்பட்டது' : 'Your proposal was accepted'} tone="success">{tamil ? 'Customer இந்த requirement-க்கு உங்கள் proposal-ஐ தேர்வு செய்துள்ளார். Quote, start date மற்றும் requirement விவரங்களை review செய்து அடுத்த coordination-க்கு தயாராகுங்கள்.' : 'The customer selected your proposal for this requirement. Review your quote, start date and requirement details, then prepare for the next coordination step.'}</Alert> : null}
          <dl className="review-details"><div><dt>{t('lead.requirement')}</dt><dd>{proposal.requirement_reference}</dd></div><div><dt>{t('common.category')}</dt><dd>{proposal.category_name}</dd></div><div><dt>{t('common.location')}</dt><dd>{proposal.location_name}</dd></div><div><dt>{t('lead.yourQuote')}</dt><dd>{money(proposal.amount_minor, proposal.currency)}</dd></div><div><dt>Quote basis</dt><dd>{pricingBasisLabel(proposal.pricing_basis || 'per_occurrence')}</dd></div><div><dt>{t('lead.startDate')}</dt><dd>{proposal.estimated_start_date || t('common.flexible')}</dd></div><div><dt>{t('lead.requirementStatus')}</dt><dd>{status(proposal.requirement_status)}</dd></div></dl>
          <p className="detail-copy">{proposal.message}</p><div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'start' }}>{proposal.status === 'submitted' && proposal.requirement_status === 'open' ? <Button type="button" variant="quiet" loading={busyId === proposal.id} onClick={() => void withdrawProposal(proposal)}>{t('lead.withdraw')}</Button> : null}<MarketplaceReportForm targetType="requirement" targetId={proposal.requirement_id} label={t('lead.reportRequirement')} /></div>
        </Card>;
      })}
    </section>
    <style jsx global>{`
      .provider-targeted-lead, .provider-targeted-proposal { scroll-margin-top: 180px; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-selected), var(--shadow-card); }
      .provider-targeted-lead:focus, .provider-targeted-proposal:focus { outline: 2px solid var(--color-primary); outline-offset: 3px; }
      .provider-lead-match-context { display: grid; gap: .55rem; margin-top: 1rem; padding: .85rem 1rem; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-selected); }
      .provider-lead-match-context strong { color: var(--color-primary-strong); }
      .provider-lead-match-context p { margin: 0; color: var(--color-text-muted); line-height: 1.55; }
      .provider-lead-match-badges { display: flex; flex-wrap: wrap; gap: .4rem; }
      .provider-lead-response-cta { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; margin-top: 1rem; }
      .provider-lead-response-cta span, .provider-proposal-helper span { color: var(--color-text-muted); font-size: .86rem; }
      .provider-proposal-helper, .provider-proposal-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .65rem; }
    `}</style>
  </div></LiveProviderShell>;
}
