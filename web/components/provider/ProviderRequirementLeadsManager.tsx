'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';
import { MarketplaceReportForm } from '../safety/MarketplaceReportForm';
import { LiveProviderShell } from './LiveProviderShell';

type Lead = {
  id: string; requirement_reference: string; title: string; description: string; service_mode: string;
  budget_type: 'fixed' | 'range' | 'negotiable'; budget_min_minor: number | null; budget_max_minor: number | null;
  currency: 'INR' | 'USD'; needed_by: string | null; published_at: string; category_name: string; location_name: string;
  matching_service_id: string; already_proposed: boolean;
};
type Proposal = {
  id: string; proposal_reference: string; requirement_id: string; service_id: string; amount_minor: number; currency: 'INR' | 'USD';
  message: string; estimated_start_date: string | null; status: 'submitted' | 'withdrawn' | 'accepted' | 'declined'; submitted_at: string;
  decided_at: string | null; requirement_reference: string; requirement_title: string; requirement_status: string; category_name: string; location_name: string;
};
type Marketplace = { leads: Lead[]; proposals: Proposal[] };
type Draft = { amount: string; message: string; estimatedStartDate: string };
const emptyDraft: Draft = { amount: '', message: '', estimatedStartDate: '' };

function money(minor: number | null, currency: 'INR' | 'USD') { if (minor == null) return ''; return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100); }
function leadBudget(lead: Lead) { if (lead.budget_type === 'negotiable') return 'Negotiable'; if (lead.budget_type === 'fixed') return money(lead.budget_min_minor, lead.currency); return `${money(lead.budget_min_minor, lead.currency)} – ${money(lead.budget_max_minor, lead.currency)}`; }
function proposalTone(status: Proposal['status']) { if (status === 'accepted') return 'success' as const; if (status === 'submitted') return 'info' as const; if (status === 'declined') return 'danger' as const; return 'neutral' as const; }

export function ProviderRequirementLeadsManager() {
  const [marketplace, setMarketplace] = useState<Marketplace>({ leads: [], proposals: [] });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');

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
      setNotice(`Proposal sent for ${lead.requirement_reference}.`); setDrafts((current) => ({ ...current, [lead.id]: emptyDraft })); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Proposal could not be submitted.'); } finally { setBusyId(''); }
  };

  const withdrawProposal = async (proposal: Proposal) => {
    if (busyId) return; setBusyId(proposal.id); setError(''); setNotice('');
    try { const response = await fetch(`/api/provider/requirement-proposals/${encodeURIComponent(proposal.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'withdraw' }) }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || 'Proposal could not be withdrawn.'); setNotice(`Proposal ${proposal.proposal_reference} withdrawn.`); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Proposal could not be withdrawn.'); } finally { setBusyId(''); }
  };

  return <LiveProviderShell active="/provider/leads"><div style={{ display: 'grid', gap: '1.25rem' }}>
    <section><span className="eyebrow">Lead marketplace</span><h1>Requirement leads</h1><p className="detail-copy">Only open requirements matching your verified, trusted and approved service scope appear here. Send one clear proposal per requirement.</p></section>
    {error ? <Alert title="Lead marketplace unavailable" tone="danger">{error}</Alert> : null}{notice ? <Alert title="Proposal update" tone="success">{notice}</Alert> : null}
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div className="section-heading"><div><span className="eyebrow">Matched leads</span><h2>Customers looking for your service</h2></div><Badge tone="info">{marketplace.leads.length}</Badge></div>
      {loading ? <Card><p>Loading matched requirements…</p></Card> : null}{!loading && marketplace.leads.length === 0 ? <Card><p>No open requirements currently match your approved service category and city.</p></Card> : null}
      {marketplace.leads.map((lead) => { const draft = drafts[lead.id] ?? emptyDraft; const alreadyProposed = lead.already_proposed || submittedRequirementIds.has(lead.id); return <Card className="policy-card" key={lead.id}>
        <div className="section-heading"><div><span className="eyebrow">{lead.requirement_reference}</span><h3>{lead.title}</h3></div><Badge tone="success">Open</Badge></div><p className="detail-copy">{lead.description}</p>
        <dl className="review-details"><div><dt>Category</dt><dd>{lead.category_name}</dd></div><div><dt>Location</dt><dd>{lead.location_name}</dd></div><div><dt>Mode</dt><dd>{lead.service_mode}</dd></div><div><dt>Customer budget</dt><dd>{leadBudget(lead)}</dd></div><div><dt>Needed by</dt><dd>{lead.needed_by || 'Flexible'}</dd></div><div><dt>Posted</dt><dd>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(lead.published_at))}</dd></div></dl>
        {alreadyProposed ? <p className="summary-note" style={{ marginTop: '1rem' }}>You already submitted a proposal for this requirement. Track it below.</p> : <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}><label className="field"><span className="field-label">Your quote ({lead.currency})</span><input className="field-control" type="number" min="1" step="1" value={draft.amount} onChange={(event) => updateDraft(lead.id, { amount: event.target.value })} placeholder="Example: 1200" /></label><label className="field"><span className="field-label">Proposal message</span><textarea className="field-control field-textarea" rows={4} minLength={20} maxLength={2000} value={draft.message} onChange={(event) => updateDraft(lead.id, { message: event.target.value })} placeholder="Explain your approach, what is included and any important assumptions." /></label><label className="field"><span className="field-label">Estimated start date (optional)</span><input className="field-control" type="date" min={new Date().toISOString().slice(0, 10)} value={draft.estimatedStartDate} onChange={(event) => updateDraft(lead.id, { estimatedStartDate: event.target.value })} /></label><Button type="button" loading={busyId === lead.id} disabled={!draft.amount || draft.message.trim().length < 20} onClick={() => void submitProposal(lead)}>Send proposal</Button></div>}
      </Card>; })}
    </section>
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div className="section-heading"><div><span className="eyebrow">My proposals</span><h2>Track customer decisions</h2></div><Badge tone="neutral">{marketplace.proposals.length}</Badge></div>
      {marketplace.proposals.length === 0 ? <Card><p>No proposals submitted yet.</p></Card> : marketplace.proposals.map((proposal) => <Card className="policy-card" key={proposal.id}>
        <div className="section-heading"><div><span className="eyebrow">{proposal.proposal_reference}</span><h3>{proposal.requirement_title}</h3></div><Badge tone={proposalTone(proposal.status)}>{proposal.status}</Badge></div>
        <dl className="review-details"><div><dt>Requirement</dt><dd>{proposal.requirement_reference}</dd></div><div><dt>Category</dt><dd>{proposal.category_name}</dd></div><div><dt>Location</dt><dd>{proposal.location_name}</dd></div><div><dt>Your quote</dt><dd>{money(proposal.amount_minor, proposal.currency)}</dd></div><div><dt>Start date</dt><dd>{proposal.estimated_start_date || 'Flexible'}</dd></div><div><dt>Requirement status</dt><dd>{proposal.requirement_status}</dd></div></dl>
        <p className="detail-copy">{proposal.message}</p><div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'start' }}>{proposal.status === 'submitted' && proposal.requirement_status === 'open' ? <Button type="button" variant="quiet" loading={busyId === proposal.id} onClick={() => void withdrawProposal(proposal)}>Withdraw proposal</Button> : null}<MarketplaceReportForm targetType="requirement" targetId={proposal.requirement_id} label="Report requirement" /></div>
      </Card>)}
    </section>
  </div></LiveProviderShell>;
}
