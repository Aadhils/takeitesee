'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

type RequirementStatus = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';

type RequirementAttentionRow = {
  id: string;
  reference: string;
  title: string;
  status: RequirementStatus;
  proposal_count: number | null;
  submitted_proposal_count: number | null;
  unread_proposal_count: number | null;
  latest_proposal_reference: string | null;
  latest_proposal_at: string | null;
  latest_unread_proposal_reference: string | null;
};

type RequirementAttentionPayload = {
  requirements?: RequirementAttentionRow[];
  proposal_attention_status?: 'ready' | 'unavailable';
  error?: string;
};

function statusTone(value: RequirementStatus) {
  if (value === 'open' || value === 'fulfilled') return 'success' as const;
  if (value === 'paused') return 'warning' as const;
  if (value === 'awarded') return 'info' as const;
  return 'neutral' as const;
}

export default function CustomerRequirementProposalAttention() {
  const router = useRouter();
  const { locale, status } = useOperationalTranslations();
  const [rows, setRows] = useState<RequirementAttentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [attentionAvailable, setAttentionAvailable] = useState(true);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState('');
  const tamil = locale.toLowerCase().startsWith('ta');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/requirements', { cache: 'no-store' });
      const payload = await response.json() as RequirementAttentionPayload;
      if (!response.ok) throw new Error(payload.error || 'Proposal activity could not be loaded.');
      setRows(payload.requirements ?? []);
      setAttentionAvailable(payload.proposal_attention_status !== 'unavailable');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Proposal activity could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalUnread = useMemo(
    () => rows.reduce((sum, row) => sum + Math.max(0, row.unread_proposal_count ?? 0), 0),
    [rows],
  );
  const requirementsWithProposals = useMemo(
    () => rows.filter((row) => (row.proposal_count ?? 0) > 0).length,
    [rows],
  );

  const reviewProposals = async (row: RequirementAttentionRow) => {
    if (openingId) return;
    setOpeningId(row.id);
    const proposalReference = row.latest_unread_proposal_reference || row.latest_proposal_reference;
    const target = proposalReference
      ? `/requirements/${encodeURIComponent(row.id)}?proposal=${encodeURIComponent(proposalReference)}`
      : `/requirements/${encodeURIComponent(row.id)}`;

    try {
      if ((row.unread_proposal_count ?? 0) > 0) {
        const response = await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mark_requirement_proposals_read: true, requirement_id: row.id }),
        });
        if (response.ok) {
          setRows((current) => current.map((item) => item.id === row.id ? { ...item, unread_proposal_count: 0 } : item));
        }
      }
    } catch {
      // Notification acknowledgement is best effort; proposal review must remain reachable.
    } finally {
      router.push(target);
    }
  };

  const latestLabel = (value: string | null) => {
    if (!value) return tamil ? 'இன்னும் proposal வரவில்லை' : 'No proposals yet';
    return `${tamil ? 'சமீபத்திய proposal' : 'Latest proposal'} · ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))}`;
  };

  return <section className="customer-proposal-attention" aria-labelledby="proposal-attention-title">
    <div className="section-heading">
      <div>
        <span className="eyebrow">{tamil ? 'Proposal activity' : 'Proposal activity'}</span>
        <h2 id="proposal-attention-title">{tamil ? 'உங்கள் Requirements-க்கு வந்த Proposals' : 'Proposals for your requirements'}</h2>
        <p className="summary-note">{tamil ? 'புதிய proposal வந்த requirement-ஐ உடனே கண்டுபிடித்து, exact latest proposal-ஐ review செய்யலாம்.' : 'Spot requirements with new proposals and jump directly to the latest proposal for review.'}</p>
      </div>
      <div className="customer-proposal-attention-summary">
        {totalUnread > 0 ? <Badge tone="info">{totalUnread} {tamil ? 'புதியது' : totalUnread === 1 ? 'new proposal' : 'new proposals'}</Badge> : null}
        <Badge tone="neutral">{requirementsWithProposals} {tamil ? 'proposal உள்ள requirements' : requirementsWithProposals === 1 ? 'requirement with proposals' : 'requirements with proposals'}</Badge>
      </div>
    </div>

    {loading ? <Card><p>{tamil ? 'Proposal activity load ஆகிறது…' : 'Loading proposal activity…'}</p></Card> : null}
    {!loading && error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>{tamil ? 'மீண்டும் முயற்சி செய்' : 'Try again'}</Button></Card> : null}
    {!loading && !error && !attentionAvailable ? <Card><p className="summary-note">{tamil ? 'Requirements கிடைக்கிறது; proposal attention மட்டும் தற்காலிகமாக கிடைக்கவில்லை.' : 'Your requirements are available, but proposal attention is temporarily unavailable.'}</p></Card> : null}

    {!loading && !error && attentionAvailable && rows.length === 0 ? <Card><p className="summary-note">{tamil ? 'இன்னும் requirement இல்லை. கீழே புதிய requirement post செய்யலாம்.' : 'No requirements yet. You can post a new requirement below.'}</p></Card> : null}

    {!loading && !error && attentionAvailable && rows.length > 0 ? <div className="customer-proposal-attention-list">
      {rows.map((row) => {
        const proposalCount = Math.max(0, row.proposal_count ?? 0);
        const submittedCount = Math.max(0, row.submitted_proposal_count ?? 0);
        const unreadCount = Math.max(0, row.unread_proposal_count ?? 0);
        return <Card key={row.id} className={`customer-proposal-attention-row${unreadCount ? ' customer-proposal-attention-row-new' : ''}`}>
          <div className="customer-proposal-attention-main">
            <div>
              <div className="customer-proposal-attention-titleline"><span className="eyebrow">{row.reference}</span>{unreadCount > 0 ? <Badge tone="info">{unreadCount} {tamil ? 'புதிய proposal' : unreadCount === 1 ? 'new proposal' : 'new proposals'}</Badge> : null}</div>
              <h3>{row.title}</h3>
              <p className="summary-note">{latestLabel(row.latest_proposal_at)}</p>
            </div>
            <Badge tone={statusTone(row.status)}>{status(row.status)}</Badge>
          </div>
          <div className="customer-proposal-attention-meta">
            <Badge tone={proposalCount ? 'neutral' : 'neutral'}>{proposalCount} {tamil ? 'மொத்த proposals' : proposalCount === 1 ? 'proposal' : 'proposals'}</Badge>
            {submittedCount > 0 ? <Badge tone="success">{submittedCount} {tamil ? 'review செய்யலாம்' : submittedCount === 1 ? 'active to review' : 'active to review'}</Badge> : null}
          </div>
          <div className="customer-proposal-attention-actions">
            {proposalCount > 0
              ? <Button type="button" loading={openingId === row.id} disabled={Boolean(openingId && openingId !== row.id)} onClick={() => void reviewProposals(row)}>{unreadCount > 0 ? (tamil ? 'புதிய Proposals review செய்' : 'Review new proposals') : (tamil ? 'Proposals review செய்' : 'Review proposals')}</Button>
              : <Link className="button button-secondary" href={`/requirements/${encodeURIComponent(row.id)}`}>{tamil ? 'Requirement பார்க்க' : 'View requirement'}</Link>}
          </div>
        </Card>;
      })}
    </div> : null}

    <style jsx global>{`
      .customer-proposal-attention { display: grid; gap: 1rem; }
      .customer-proposal-attention-summary, .customer-proposal-attention-meta, .customer-proposal-attention-titleline, .customer-proposal-attention-actions { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
      .customer-proposal-attention-summary { justify-content: flex-end; }
      .customer-proposal-attention-list { display: grid; gap: .75rem; }
      .customer-proposal-attention-row { display: grid; gap: .75rem; }
      .customer-proposal-attention-row-new { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-selected); }
      .customer-proposal-attention-main { display: flex; justify-content: space-between; gap: .85rem; align-items: flex-start; }
      .customer-proposal-attention-main h3 { margin: .2rem 0 .3rem; }
      .customer-proposal-attention-titleline { align-items: center; }
      @media (max-width: 720px) {
        .customer-proposal-attention-main { flex-direction: column; }
        .customer-proposal-attention-summary { justify-content: flex-start; }
      }
    `}</style>
  </section>;
}
