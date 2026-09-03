'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';
import { MarketplaceReportForm } from '../safety/MarketplaceReportForm';
import { LiveProviderShell } from './LiveProviderShell';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

type Lead = {
  id: string; requirement_reference: string; title: string; description: string; service_mode: string;
  budget_type: 'fixed' | 'range' | 'negotiable'; budget_min_minor: number | null; budget_max_minor: number | null;
  currency: 'INR' | 'USD'; needed_by: string | null; preferred_start_time: string | null; expected_duration_minutes: number | null;
  published_at: string; category_name: string; location_name: string; matching_service_id: string; already_proposed: boolean;
};
type Proposal = {
  id: string; proposal_reference: string; requirement_id: string; service_id: string; amount_minor: number; currency: 'INR' | 'USD';
  message: string; estimated_start_date: string | null; status: 'submitted' | 'withdrawn' | 'accepted' | 'declined'; submitted_at: string;
  decided_at: string | null; requirement_reference: string; requirement_title: string; requirement_status: string; category_name: string; location_name: string;
};
type Marketplace = { leads: Lead[]; proposals: Proposal[] };
type Draft = { amount: string; message: string; estimatedStartDate: string };
const emptyDraft: Draft = { amount: '', message: '', estimatedStartDate: '' };

function proposalTone(status: Proposal['status']) { if (status === 'accepted') return 'success' as const; if (status === 'submitted') return 'info' as const; if (status === 'declined') return 'danger' as const; return 'neutral' as const; }

export function ProviderRequirementLeadsManager() {
  const { locale, t, status } = useOperationalTranslations();
  const [marketplace, setMarketplace] = useState<Marketplace>({ leads: [], proposals: [] });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');

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

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await fetch('/api/provider/requirement-leads', { cache: 'no-store' }); const payload = await response.json() as { marketplace?: Marketplace; error?: string }; if (!response.ok || !payload.marketplace) throw new Error(payload.error || 'Provider leads could not be loaded.'); setMarketplace({ leads: payload.marketplace.leads ?? [], proposals: payload.marketplace.proposals ?? [] }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Provider leads could not be loaded.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const submittedRequirementIds = useMemo(() => new Set(marketplace.proposals.map((p) => p.requirement_id)), [marketplace.proposals]);
  const updateDraft = (leadId: string, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [leadId]: { ...(current[leadId] ?? emptyDraft), ...patch } }));

  const submitProposal = async (lead: Lead) => {
    const draft = drafts[lead.id] ?? emptyDraft; const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0 || draft.message.trim().length < 20 || busyId) return;
    setBusyId(lead.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/provider/requirement-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirement_id: lead.id, service_id: lead.matching_service_id, amount_minor: Math.round(amount * 100), message: draft.message, estimated_start_date: draft.estimatedStartDate || null }) });
      const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || 'Proposal could not be submitted.');
      setNotice(`${t('lead.sentFor')} ${lead.requirement_reference}.`); setDrafts((current) => ({ ...current, [lead.id]: emptyDraft })); await load();
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
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div className="section-heading"><div><span className="eyebrow">{t('lead.matched')}</span><h2>{t('lead.customersLooking')}</h2></div><Badge tone="info">{marketplace.leads.length}</Badge></div>
      {loading ? <Card><p>{t('lead.loading')}</p></Card> : null}{!loading && marketplace.leads.length === 0 ? <Card><p>{t('lead.none')}</p></Card> : null}
      {marketplace.leads.map((lead) => { const draft = drafts[lead.id] ?? emptyDraft; const alreadyProposed = lead.already_proposed || submittedRequirementIds.has(lead.id); return <Card className="policy-card" key={lead.id}>
        <div className="section-heading"><div><span className="eyebrow">{lead.requirement_reference}</span><h3>{lead.title}</h3></div><Badge tone="success">{t('common.open')}</Badge></div><p className="detail-copy">{lead.description}</p>
        <dl className="review-details"><div><dt>{t('common.category')}</dt><dd>{lead.category_name}</dd></div><div><dt>{t('common.location')}</dt><dd>{lead.location_name}</dd></div><div><dt>{t('common.mode')}</dt><dd>{modeLabel(lead.service_mode)}</dd></div><div><dt>{t('lead.customerBudget')}</dt><dd>{leadBudget(lead)}</dd></div><div><dt>{t('common.neededBy')}</dt><dd>{lead.needed_by || t('common.flexible')}</dd></div><div><dt>{tamil ? 'விருப்பமான தொடக்க நேரம்' : 'Preferred start time'}</dt><dd>{startTimeLabel(lead.preferred_start_time)}</dd></div><div><dt>{tamil ? 'எதிர்பார்க்கப்படும் கால அளவு' : 'Expected duration'}</dt><dd>{durationLabel(lead.expected_duration_minutes)}</dd></div><div><dt>{t('common.posted')}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(lead.published_at))}</dd></div></dl>
        {alreadyProposed ? <p className="summary-note" style={{ marginTop: '1rem' }}>{t('lead.already')}</p> : <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}><label className="field"><span className="field-label">{t('lead.yourQuote')} ({lead.currency})</span><input className="field-control" type="number" min="1" step="1" value={draft.amount} onChange={(event) => updateDraft(lead.id, { amount: event.target.value })} placeholder="1200" /></label><label className="field"><span className="field-label">{t('lead.proposalMessage')}</span><textarea className="field-control field-textarea" rows={4} minLength={20} maxLength={2000} value={draft.message} onChange={(event) => updateDraft(lead.id, { message: event.target.value })} placeholder={t('lead.proposalPlaceholder')} /></label><label className="field"><span className="field-label">{t('lead.startOptional')}</span><input className="field-control" type="date" min={new Date().toISOString().slice(0, 10)} value={draft.estimatedStartDate} onChange={(event) => updateDraft(lead.id, { estimatedStartDate: event.target.value })} /></label><Button type="button" loading={busyId === lead.id} disabled={!draft.amount || draft.message.trim().length < 20} onClick={() => void submitProposal(lead)}>{t('lead.send')}</Button></div>}
      </Card>; })}
    </section>
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div className="section-heading"><div><span className="eyebrow">{t('lead.myProposals')}</span><h2>{t('lead.track')}</h2></div><Badge tone="neutral">{marketplace.proposals.length}</Badge></div>
      {marketplace.proposals.length === 0 ? <Card><p>{t('lead.noneSubmitted')}</p></Card> : marketplace.proposals.map((proposal) => <Card className="policy-card" key={proposal.id}>
        <div className="section-heading"><div><span className="eyebrow">{proposal.proposal_reference}</span><h3>{proposal.requirement_title}</h3></div><Badge tone={proposalTone(proposal.status)}>{status(proposal.status)}</Badge></div>
        <dl className="review-details"><div><dt>{t('lead.requirement')}</dt><dd>{proposal.requirement_reference}</dd></div><div><dt>{t('common.category')}</dt><dd>{proposal.category_name}</dd></div><div><dt>{t('common.location')}</dt><dd>{proposal.location_name}</dd></div><div><dt>{t('lead.yourQuote')}</dt><dd>{money(proposal.amount_minor, proposal.currency)}</dd></div><div><dt>{t('lead.startDate')}</dt><dd>{proposal.estimated_start_date || t('common.flexible')}</dd></div><div><dt>{t('lead.requirementStatus')}</dt><dd>{status(proposal.requirement_status)}</dd></div></dl>
        <p className="detail-copy">{proposal.message}</p><div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'start' }}>{proposal.status === 'submitted' && proposal.requirement_status === 'open' ? <Button type="button" variant="quiet" loading={busyId === proposal.id} onClick={() => void withdrawProposal(proposal)}>{t('lead.withdraw')}</Button> : null}<MarketplaceReportForm targetType="requirement" targetId={proposal.requirement_id} label={t('lead.reportRequirement')} /></div>
      </Card>)}
    </section>
  </div></LiveProviderShell>;
}
