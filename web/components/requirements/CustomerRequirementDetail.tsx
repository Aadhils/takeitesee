'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';

type RequirementStatus = 'open' | 'paused' | 'fulfilled' | 'cancelled';
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
  created_at: string;
  updated_at: string;
  platform_categories?: { name?: string | null } | Array<{ name?: string | null }> | null;
  platform_locations?: { name?: string | null } | Array<{ name?: string | null }> | null;
};
type RequirementEvent = { id: string; event_type: 'created' | 'status_changed'; from_status: string | null; to_status: string; created_at: string };

function relationName(value: RequirementRow['platform_categories'] | RequirementRow['platform_locations']) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name || '';
}

function formatBudget(row: RequirementRow) {
  if (row.budget_type === 'negotiable') return 'Negotiable';
  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: row.currency, maximumFractionDigits: 0 });
  if (row.budget_type === 'fixed') return formatter.format(Number(row.budget_min_minor ?? 0) / 100);
  return `${formatter.format(Number(row.budget_min_minor ?? 0) / 100)} – ${formatter.format(Number(row.budget_max_minor ?? 0) / 100)}`;
}

function tone(status: RequirementStatus) {
  if (status === 'open') return 'success' as const;
  if (status === 'paused') return 'warning' as const;
  if (status === 'fulfilled') return 'info' as const;
  return 'neutral' as const;
}

export default function CustomerRequirementDetail({ requirementId }: { requirementId: string }) {
  const [requirement, setRequirement] = useState<RequirementRow | null>(null);
  const [events, setEvents] = useState<RequirementEvent[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}`, { cache: 'no-store' });
      const payload = await response.json() as { requirement?: RequirementRow; events?: RequirementEvent[]; error?: string };
      if (!response.ok || !payload.requirement) throw new Error(payload.error || 'Requirement could not be loaded.');
      setRequirement(payload.requirement);
      setEvents(payload.events ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Requirement could not be loaded.'); }
  }, [requirementId]);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (status: RequirementStatus) => {
    if (!requirement || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Requirement could not be updated.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Requirement could not be updated.'); }
    finally { setBusy(false); }
  };

  if (!requirement) return <div style={{ display: 'grid', gap: '1rem' }}><Link href="/requirements">← Back to requirements</Link><Card><p>{error || 'Loading requirement…'}</p></Card></div>;

  const categoryName = relationName(requirement.platform_categories);
  const locationName = relationName(requirement.platform_locations);

  return <div style={{ display: 'grid', gap: '1rem' }}>
    <Link href="/requirements">← Back to requirements</Link>
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    <Card className="policy-card">
      <div className="section-heading"><div><span className="eyebrow">{requirement.requirement_reference}</span><h1>{requirement.title}</h1></div><Badge tone={tone(requirement.status)}>{requirement.status}</Badge></div>
      <p className="detail-copy">{requirement.description}</p>
      <dl className="review-details">
        <div><dt>Category</dt><dd>{categoryName || 'Service'}</dd></div>
        <div><dt>Location</dt><dd>{locationName || 'Location'}</dd></div>
        <div><dt>Service mode</dt><dd>{requirement.service_mode}</dd></div>
        <div><dt>Budget</dt><dd>{formatBudget(requirement)}</dd></div>
        <div><dt>Needed by</dt><dd>{requirement.needed_by || 'Flexible'}</dd></div>
        <div><dt>Posted</dt><dd>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(requirement.published_at))}</dd></div>
      </dl>
      {['open','paused'].includes(requirement.status) ? <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        {requirement.status === 'open' ? <Button type="button" variant="quiet" loading={busy} onClick={() => void updateStatus('paused')}>Pause</Button> : null}
        {requirement.status === 'paused' ? <Button type="button" variant="secondary" loading={busy} onClick={() => void updateStatus('open')}>Reopen</Button> : null}
        <Button type="button" variant="secondary" loading={busy} onClick={() => void updateStatus('fulfilled')}>Mark fulfilled</Button>
        <Button type="button" variant="danger" loading={busy} onClick={() => void updateStatus('cancelled')}>Cancel</Button>
      </div> : <p className="summary-note" style={{ marginTop: '1rem' }}>This requirement is closed and cannot be reopened.</p>}
    </Card>

    <Card className="policy-card">
      <span className="eyebrow">Audit history</span><h2>Requirement lifecycle</h2>
      <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
        {events.map((event) => <div key={event.id} style={{ borderBottom: '1px solid #ececf2', paddingBottom: '.75rem' }}>
          <strong>{event.event_type === 'created' ? 'Requirement posted' : `Status changed to ${event.to_status}`}</strong>
          <p className="summary-note">{event.from_status ? `${event.from_status} → ${event.to_status} · ` : ''}{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.created_at))}</p>
        </div>)}
      </div>
    </Card>
  </div>;
}
