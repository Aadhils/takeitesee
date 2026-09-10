'use client';

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

type CustomerAccountProposalSummaryProps = {
  onUnreadChange?: (count: number) => void;
};

export default function CustomerAccountProposalSummary({ onUnreadChange }: CustomerAccountProposalSummaryProps) {
  const router = useRouter();
  const { locale } = useOperationalTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const [rows, setRows] = useState<RequirementAttentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [openingId, setOpeningId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/requirements', { cache: 'no-store' });
      if (!response.ok) {
        setAvailable(false);
        return;
      }
      const payload = await response.json() as RequirementAttentionPayload;
      setRows(payload.requirements ?? []);
      setAvailable(payload.proposal_attention_status !== 'unavailable');
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const proposalRows = useMemo(() => rows
    .filter((row) => (row.proposal_count ?? 0) > 0)
    .sort((left, right) => {
      const unread = (right.unread_proposal_count ?? 0) - (left.unread_proposal_count ?? 0);
      if (unread) return unread;
      return new Date(right.latest_proposal_at ?? 0).getTime() - new Date(left.latest_proposal_at ?? 0).getTime();
    }), [rows]);

  const attentionRows = useMemo(() => proposalRows.filter((row) => (row.unread_proposal_count ?? 0) > 0), [proposalRows]);
  const totalUnread = useMemo(() => attentionRows.reduce((sum, row) => sum + Math.max(0, row.unread_proposal_count ?? 0), 0), [attentionRows]);
  const visibleRows = proposalRows.slice(0, 3);

  useEffect(() => {
    onUnreadChange?.(available ? totalUnread : 0);
  }, [available, onUnreadChange, totalUnread]);

  const review = async (row: RequirementAttentionRow) => {
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
      // Acknowledgement is best effort; proposal review remains reachable.
    } finally {
      router.push(target);
    }
  };

  const latestLabel = (value: string | null) => {
    if (!value) return tamil ? 'Proposal activity இல்லை' : 'No proposal activity';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  };

  if (loading) return <Card><span className="eyebrow">{tamil ? 'Proposal கவனம்' : 'Proposal attention'}</span><p className="summary-note">{tamil ? 'புதிய proposal activity load ஆகிறது…' : 'Loading proposal activity…'}</p></Card>;
  if (!available) return null;

  return <Card className="customer-account-proposal-summary">
    <div className="section-heading">
      <div>
        <span className="eyebrow">{tamil ? 'Proposal கவனம்' : 'Proposal attention'}</span>
        <h2>{tamil ? 'Requirements needing attention' : 'Requirements needing attention'}</h2>
        <p className="summary-note">{tamil ? 'புதிய provider proposals வந்த requirements-ஐ இங்கிருந்தே review செய்யலாம்.' : 'Review new provider proposals without leaving your customer dashboard first.'}</p>
      </div>
      <div className="customer-account-proposal-summary-badges">
        {totalUnread > 0 ? <Badge tone="info">{totalUnread} {tamil ? 'புதிய proposals' : totalUnread === 1 ? 'new proposal' : 'new proposals'}</Badge> : <Badge tone="neutral">{tamil ? 'புதிய proposal இல்லை' : 'No new proposals'}</Badge>}
        {attentionRows.length > 0 ? <Badge tone="neutral">{attentionRows.length} {tamil ? 'requirements கவனம் தேவை' : attentionRows.length === 1 ? 'requirement needs attention' : 'requirements need attention'}</Badge> : null}
      </div>
    </div>

    {visibleRows.length === 0 ? <div className="customer-account-proposal-empty">
      <p className="summary-note">{tamil ? 'இப்போது proposal activity இல்லை. உங்கள் requirements-ஐ manage செய்யலாம் அல்லது புதிய requirement post செய்யலாம்.' : 'No proposal activity yet. Manage your requirements or post a new requirement when you need a service.'}</p>
      <Button type="button" variant="secondary" onClick={() => router.push('/requirements')}>{tamil ? 'என் Requirements' : 'My requirements'}</Button>
    </div> : <div className="customer-account-proposal-list">
      {visibleRows.map((row) => {
        const unread = Math.max(0, row.unread_proposal_count ?? 0);
        return <div key={row.id} className={`customer-account-proposal-row${unread ? ' customer-account-proposal-row-new' : ''}`}>
          <div>
            <div className="customer-account-proposal-titleline">
              <span className="eyebrow">{row.reference}</span>
              {unread > 0 ? <Badge tone="info">{unread} {tamil ? 'புதியது' : 'new'}</Badge> : null}
            </div>
            <strong>{row.title}</strong>
            <span className="summary-note">{tamil ? 'சமீபத்திய proposal' : 'Latest proposal'} · {latestLabel(row.latest_proposal_at)}</span>
          </div>
          <Button type="button" variant={unread > 0 ? 'primary' : 'secondary'} loading={openingId === row.id} disabled={Boolean(openingId && openingId !== row.id)} onClick={() => void review(row)}>{unread > 0 ? (tamil ? 'புதிய proposal review செய்' : 'Review new proposal') : (tamil ? 'Proposals பார்க்க' : 'View proposals')}</Button>
        </div>;
      })}
      <Button type="button" variant="quiet" onClick={() => router.push('/requirements')}>{tamil ? 'அனைத்து Requirements பார்க்க' : 'View all requirements'}</Button>
    </div>}

    <style jsx global>{`
      .customer-account-proposal-summary { display: grid; gap: .9rem; }
      .customer-account-proposal-summary-badges, .customer-account-proposal-titleline { display: flex; gap: .45rem; flex-wrap: wrap; align-items: center; }
      .customer-account-proposal-summary-badges { justify-content: flex-end; }
      .customer-account-proposal-list { display: grid; gap: .65rem; }
      .customer-account-proposal-row { display: flex; justify-content: space-between; gap: .8rem; align-items: center; padding: .75rem; border: 1px solid var(--color-border); border-radius: 14px; }
      .customer-account-proposal-row > div { display: grid; gap: .2rem; min-width: 0; }
      .customer-account-proposal-row strong, .customer-account-proposal-row .summary-note { overflow: hidden; text-overflow: ellipsis; }
      .customer-account-proposal-row-new { border-color: var(--color-primary); background: var(--color-selected); }
      .customer-account-proposal-empty { display: flex; justify-content: space-between; gap: .75rem; align-items: center; }
      @media (max-width: 720px) {
        .customer-account-proposal-summary-badges { justify-content: flex-start; }
        .customer-account-proposal-row, .customer-account-proposal-empty { align-items: stretch; flex-direction: column; }
      }
    `}</style>
  </Card>;
}
