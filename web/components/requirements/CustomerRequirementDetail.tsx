'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';
import { MarketplaceReportForm } from '../safety/MarketplaceReportForm';
import { RequirementJobPanel } from './RequirementJobPanel';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

type RequirementStatus = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
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
  message: string;
  estimated_start_date: string | null;
  status: 'submitted' | 'withdrawn' | 'accepted' | 'declined';
  submitted_at: string;
  decided_at: string | null;
};

function relationName(value: RequirementRow['platform_categories'] | RequirementRow['platform_locations']) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name || '';
}
function formatMoney(minor: number, currency: 'INR' | 'USD', locale: string) { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100); }
function formatBudget(row: RequirementRow, locale: string, negotiableLabel: string) { if (row.budget_type === 'negotiable') return negotiableLabel; if (row.budget_type === 'fixed') return formatMoney(Number(row.budget_min_minor ?? 0), row.currency, locale); return `${formatMoney(Number(row.budget_min_minor ?? 0), row.currency, locale)} – ${formatMoney(Number(row.budget_max_minor ?? 0), row.currency, locale)}`; }
function tone(status: RequirementStatus) { if (status === 'open') return 'success' as const; if (status === 'paused') return 'warning' as const; if (status === 'awarded') return 'info' as const; if (status === 'fulfilled') return 'success' as const; return 'neutral' as const; }
function proposalTone(status: Proposal['status']) { if (status === 'accepted') return 'success' as const; if (status === 'submitted') return 'info' as const; if (status === 'declined') return 'danger' as const; return 'neutral' as const; }

export default function CustomerRequirementDetail({ requirementId }: { requirementId: string }) {
  const { locale, t, status } = useOperationalTranslations();
  const [requirement, setRequirement] = useState<RequirementRow | null>(null);
  const [events, setEvents] = useState<RequirementEvent[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposalBusyId, setProposalBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}`, { cache: 'no-store' });
      const payload = await response.json() as { requirement?: RequirementRow; events?: RequirementEvent[]; proposals?: Proposal[]; error?: string };
      if (!response.ok || !payload.requirement) throw new Error(payload.error || 'Requirement could not be loaded.');
      setRequirement(payload.requirement); setEvents(payload.events ?? []); setProposals(payload.proposals ?? []);
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
      setNotice(decision === 'accept' ? t('req.providerSelected') : t('req.proposalDeclined')); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('req.updateFailedFallback')); }
    finally { setProposalBusyId(''); }
  };

  if (!requirement) return <div style={{ display: 'grid', gap: '1rem' }}><Link href="/requirements">← {t('req.back')}</Link><Card><p>{error || t('common.loading')}</p></Card></div>;
  const categoryName = relationName(requirement.platform_categories);
  const locationName = relationName(requirement.platform_locations);
  const canReviewProposals = ['open', 'paused'].includes(requirement.status);

  return <div style={{ display: 'grid', gap: '1rem' }}>
    <Link href="/requirements">← {t('req.back')}</Link>
    {error ? <Alert title={t('req.updateFailed')} tone="danger">{error}</Alert> : null}
    {notice ? <Alert title={t('req.updated')} tone="success">{notice}</Alert> : null}
    <Card className="policy-card">
      <div className="section-heading"><div><span className="eyebrow">{requirement.requirement_reference}</span><h1>{requirement.title}</h1></div><Badge tone={tone(requirement.status)}>{status(requirement.status)}</Badge></div>
      <p className="detail-copy">{requirement.description}</p>
      <dl className="review-details"><div><dt>{t('common.category')}</dt><dd>{categoryName || t('common.service')}</dd></div><div><dt>{t('common.location')}</dt><dd>{locationName || t('common.location')}</dd></div><div><dt>{t('req.serviceMode')}</dt><dd>{status(requirement.service_mode)}</dd></div><div><dt>{t('common.budget')}</dt><dd>{formatBudget(requirement, locale, t('req.negotiable'))}</dd></div><div><dt>{t('common.neededBy')}</dt><dd>{requirement.needed_by || t('common.flexible')}</dd></div><div><dt>{t('common.posted')}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(requirement.published_at))}</dd></div></dl>
      {['open','paused'].includes(requirement.status) ? <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>{requirement.status === 'open' ? <Button type="button" variant="quiet" loading={busy} onClick={() => void updateStatus('paused')}>{t('req.pauseNew')}</Button> : null}{requirement.status === 'paused' ? <Button type="button" variant="secondary" loading={busy} onClick={() => void updateStatus('open')}>{t('req.reopen')}</Button> : null}<Button type="button" variant="secondary" loading={busy} onClick={() => void updateStatus('fulfilled')}>{t('req.markFulfilled')}</Button><Button type="button" variant="danger" loading={busy} onClick={() => void updateStatus('cancelled')}>{t('common.cancel')}</Button></div> : requirement.status === 'awarded' ? <div style={{ display: 'grid', gap: '.65rem', marginTop: '1rem' }}><div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}><Link className="button button-primary" href="/messages">{t('req.openChat')}</Link><Button type="button" variant="danger" loading={busy} onClick={() => void updateStatus('cancelled')}>{t('req.cancelRequirement')}</Button></div><p className="summary-note">{t('req.awardedNote')}</p></div> : <p className="summary-note" style={{ marginTop: '1rem' }}>{t('req.closedNote')}</p>}
    </Card>

    <Card className="policy-card">
      <div className="section-heading"><div><span className="eyebrow">{t('req.providerProposals')}</span><h2>{t('req.compareProviders')}</h2></div><Badge tone="info">{proposals.length}</Badge></div>
      {proposals.length === 0 ? <p className="detail-copy">{t('req.noProposals')}</p> : <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        {proposals.map((proposal) => <div key={proposal.id} style={{ border: '1px solid #e7eaf0', borderRadius: '16px', padding: '1rem' }}>
          <div className="section-heading"><div><span className="eyebrow">{proposal.proposal_reference}</span><h3>{proposal.provider_display_name}</h3><p className="summary-note">{status(proposal.provider_type)} · {proposal.service_name}</p></div><Badge tone={proposalTone(proposal.status)}>{status(proposal.status)}</Badge></div>
          <dl className="review-details"><div><dt>{t('common.quote')}</dt><dd>{formatMoney(proposal.amount_minor, proposal.currency, locale)}</dd></div><div><dt>{t('common.estimatedStart')}</dt><dd>{proposal.estimated_start_date || t('common.flexible')}</dd></div><div><dt>{t('common.submitted')}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(proposal.submitted_at))}</dd></div></dl>
          <p className="detail-copy">{proposal.message}</p>
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'start' }}>{proposal.status === 'submitted' && canReviewProposals ? <><Button type="button" loading={proposalBusyId === proposal.id} onClick={() => void decideProposal(proposal.id, 'accept')}>{t('req.acceptProposal')}</Button><Button type="button" variant="quiet" loading={proposalBusyId === proposal.id} onClick={() => void decideProposal(proposal.id, 'decline')}>{t('req.decline')}</Button></> : null}<MarketplaceReportForm targetType="proposal" targetId={proposal.id} label={t('req.reportProposal')} /></div>
          {proposal.status === 'accepted' ? <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '.6rem' }}><Link className="button button-secondary" href="/messages">{t('req.openChat')}</Link><p className="summary-note">{t('req.privateOnly')}</p></div> : null}
        </div>)}
      </div>}
    </Card>

    {requirement.status === 'awarded' || requirement.status === 'fulfilled' ? <RequirementJobPanel requirementId={requirementId} requirementStatus={requirement.status} /> : null}
    <Card className="policy-card"><span className="eyebrow">{t('req.auditHistory')}</span><h2>{t('req.lifecycle')}</h2><div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>{events.map((event) => <div key={event.id} style={{ borderBottom: '1px solid #ececf2', paddingBottom: '.75rem' }}><strong>{event.event_type === 'created' ? t('req.postedEvent') : `${t('req.statusChanged')} ${status(event.to_status)}`}</strong><p className="summary-note">{event.from_status ? `${status(event.from_status)} → ${status(event.to_status)} · ` : ''}{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.created_at))}</p></div>)}</div></Card>
  </div>;
}
