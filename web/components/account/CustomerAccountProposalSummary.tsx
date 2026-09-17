'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const focusTargetRef = useRef<HTMLElement | null>(null);
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
  const hasRequirements = rows.length > 0;

  useEffect(() => {
    onUnreadChange?.(available ? totalUnread : 0);
  }, [available, onUnreadChange, totalUnread]);

  useEffect(() => {
    const focusIfTargeted = () => {
      if (window.location.hash !== '#proposal-attention') return;
      const target = focusTargetRef.current;
      if (!target) return;
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.focus({ preventScroll: true });
      });
    };

    focusIfTargeted();
    window.addEventListener('hashchange', focusIfTargeted);
    return () => window.removeEventListener('hashchange', focusIfTargeted);
  }, [available, loading]);

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

  if (loading) return <section id="proposal-attention" ref={focusTargetRef} tabIndex={-1} className="customer-account-proposal-focus-target"><Card><span className="eyebrow">{tamil ? 'Proposal inbox' : 'Proposal inbox'}</span><p className="summary-note">{tamil ? 'Provider replies சரிபார்க்கப்படுகிறது…' : 'Checking for provider replies…'}</p></Card></section>;
  if (!available) return null;

  const stateTitle = totalUnread > 0
    ? (tamil ? `${totalUnread} புதிய provider proposal${totalUnread === 1 ? '' : 's'}` : `${totalUnread} new provider proposal${totalUnread === 1 ? '' : 's'}`)
    : visibleRows.length > 0
      ? (tamil ? 'Provider proposals அனைத்தும் பார்த்துவிட்டீர்கள்' : 'You are up to date on provider proposals')
      : hasRequirements
        ? (tamil ? 'Provider replies க்காக காத்திருக்கிறது' : 'Waiting for provider replies')
        : (tamil ? 'ஒரு தேவை பதிவு செய்து provider proposals பெறுங்கள்' : 'Post a need to get provider proposals');
  const stateHelp = totalUnread > 0
    ? (tamil ? 'நீங்கள் post செய்த requirements-க்கு providers reply செய்துள்ளனர். புதிய replies-ஐ இங்கே review செய்யலாம்.' : 'Providers replied to your posted requirements. Review the newest replies here.')
    : visibleRows.length > 0
      ? (tamil ? 'புதிய reply இல்லை. முன்பு வந்த provider proposals கீழே கிடைக்கும்.' : 'There are no unread replies. Previous provider proposals remain available below.')
      : hasRequirements
        ? (tamil ? 'உங்கள் requirement live-ல் உள்ளது. Matching verified provider reply செய்தவுடன் அது இங்கே தோன்றும்.' : 'Your requirement is live. Matching verified providers can respond and their proposals will appear here.')
        : (tamil ? 'தேவையை பதிவு செய்யுங்கள் → verified providers reply செய்வார்கள் → proposals compare செய்து சரியான provider-ஐ தேர்வு செய்யலாம்.' : 'Post what you need → verified providers can reply → compare proposals and choose the right provider.');

  return <section id="proposal-attention" ref={focusTargetRef} tabIndex={-1} className="customer-account-proposal-focus-target" aria-label={tamil ? 'Provider proposals' : 'Provider proposals'}>
    <Card className="customer-account-proposal-summary">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{tamil ? 'Proposal inbox' : 'Proposal inbox'}</span>
          <h2>{stateTitle}</h2>
          <p className="summary-note">{stateHelp}</p>
        </div>
        <div className="customer-account-proposal-summary-badges">
          {totalUnread > 0
            ? <Badge tone="info">{totalUnread} {tamil ? 'புதிய reply' : totalUnread === 1 ? 'new reply' : 'new replies'}</Badge>
            : <Badge tone="neutral">{visibleRows.length > 0 ? (tamil ? 'புதிய reply இல்லை' : 'All caught up') : hasRequirements ? (tamil ? 'Replies க்காக காத்திருக்கிறது' : 'Waiting for replies') : (tamil ? 'Post செய்ய தயார்' : 'Ready to post')}</Badge>}
          {proposalRows.length > 0 ? <Badge tone="neutral">{proposalRows.length} {tamil ? 'requirements-ல் proposals' : proposalRows.length === 1 ? 'requirement with proposals' : 'requirements with proposals'}</Badge> : null}
        </div>
      </div>

      {visibleRows.length === 0 ? <div className="customer-account-proposal-empty">
        <div>
          <strong>{hasRequirements ? (tamil ? 'உங்கள் requirement live-ல் உள்ளது' : 'Your requirement is live') : (tamil ? 'ஒரு service தேவைப்படுகிறதா?' : 'Need a service?')}</strong>
          <p className="summary-note">{hasRequirements
            ? (tamil ? 'Provider reply வந்தவுடன் புதிய proposal இங்கே காட்டப்படும். Requirement-ஐ update அல்லது manage செய்யலாம்.' : 'New provider replies will appear here. You can update or manage your requirement anytime.')
            : (tamil ? 'Requirement post செய்யுங்கள். Matching verified providers proposals அனுப்பலாம்; புதிய replies இங்கே தோன்றும்.' : 'Post a requirement and matching verified providers can send proposals. New replies will show up here.')}</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => router.push('/requirements')}>{hasRequirements ? (tamil ? 'Requirements நிர்வகிக்க' : 'Manage requirements') : (tamil ? 'Requirement post செய்' : 'Post a requirement')}</Button>
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
        .customer-account-proposal-focus-target { margin-top: 16px; scroll-margin-top: 96px; outline: none; }
        .customer-account-proposal-focus-target:focus > .customer-account-proposal-summary { box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent), var(--shadow-md); }
        .customer-account-proposal-summary { display: grid; gap: .9rem; }
        .customer-account-proposal-summary-badges, .customer-account-proposal-titleline { display: flex; gap: .45rem; flex-wrap: wrap; align-items: center; }
        .customer-account-proposal-summary-badges { justify-content: flex-end; }
        .customer-account-proposal-list { display: grid; gap: .65rem; }
        .customer-account-proposal-row { display: flex; justify-content: space-between; gap: .8rem; align-items: center; padding: .75rem; border: 1px solid var(--color-border); border-radius: 14px; }
        .customer-account-proposal-row > div { display: grid; gap: .2rem; min-width: 0; }
        .customer-account-proposal-row strong, .customer-account-proposal-row .summary-note { overflow: hidden; text-overflow: ellipsis; }
        .customer-account-proposal-row-new { border-color: var(--color-primary); background: var(--color-selected); }
        .customer-account-proposal-empty { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: .15rem 0; }
        .customer-account-proposal-empty > div { display: grid; gap: .25rem; min-width: 0; }
        .customer-account-proposal-empty strong { color: var(--color-ink); font-size: .95rem; }
        @media (max-width: 720px) {
          .customer-account-proposal-focus-target { margin-top: 12px; }
          .customer-account-proposal-summary-badges { justify-content: flex-start; }
          .customer-account-proposal-row, .customer-account-proposal-empty { align-items: stretch; flex-direction: column; }
          .customer-account-proposal-empty .button { width: 100%; min-height: 44px; }
        }
      `}</style>
    </Card>
  </section>;
}
