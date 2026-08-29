'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Input, Select } from '../ui/primitives';

type Review = {
  id: string;
  rating: number;
  comment?: string;
  status: string;
  provider_response?: string;
  provider_responded_at?: string;
  created_at: string;
};

type Issue = {
  id: string;
  category: string;
  summary: string;
  priority: string;
  status: string;
  resolution_note?: string;
  created_at: string;
  updated_at: string;
};

type Closeout = {
  booking_id: string;
  booking_reference: string;
  service_name: string;
  booking_status: string;
  payment_status: string;
  state: 'in_progress' | 'awaiting_review' | 'reviewed' | 'support_open' | 'support_resolved' | 'cancelled';
  review: Review | null;
  issues: Issue[];
  active_issue: Issue | null;
  can_open_support: boolean;
};

const categories = ['Service quality', 'Provider no-show', 'Payment or refund', 'Safety concern', 'Other'];

function stateCopy(state: Closeout['state']) {
  if (state === 'support_open') return { label: 'Support open', tone: 'warning' as const, detail: 'A support case is active and the booking remains in operations follow-up.' };
  if (state === 'support_resolved') return { label: 'Support resolved', tone: 'success' as const, detail: 'The linked support case has been resolved or closed.' };
  if (state === 'reviewed') return { label: 'Reviewed', tone: 'success' as const, detail: 'The customer review is recorded and there is no active support case.' };
  if (state === 'awaiting_review') return { label: 'Review available', tone: 'info' as const, detail: 'The service is complete. The customer can submit one review or open support if needed.' };
  if (state === 'cancelled') return { label: 'Cancelled', tone: 'neutral' as const, detail: 'The booking is cancelled and has no active support case.' };
  return { label: 'In progress', tone: 'neutral' as const, detail: 'Closeout actions become available as the booking reaches the end of its lifecycle.' };
}

export default function BookingCloseoutPanel({ bookingId, allowSupport = false }: { bookingId: string; allowSupport?: boolean }) {
  const [closeout, setCloseout] = useState<Closeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSupport, setShowSupport] = useState(false);
  const [category, setCategory] = useState(categories[0]);
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/closeout`, { cache: 'no-store' });
      const payload = await response.json() as Closeout & { error?: string };
      if (!response.ok || !payload.booking_id) throw new Error(payload.error ?? 'Unable to load closeout state.');
      setCloseout(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load closeout state.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ bookingId?: string }>).detail;
      if (!detail?.bookingId || detail.bookingId === bookingId) void load();
    };
    window.addEventListener('booking:closeout-refresh', refresh);
    return () => window.removeEventListener('booking:closeout-refresh', refresh);
  }, [bookingId, load]);

  const openSupport = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, summary, details }),
      });
      const payload = await response.json() as { issue?: Issue; error?: string };
      if (!response.ok || !payload.issue) throw new Error(payload.error ?? 'Support case could not be opened.');
      setShowSupport(false);
      setSummary('');
      setDetails('');
      await load();
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Support case could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Card className="policy-card"><p>Loading closeout status…</p></Card>;
  if (!closeout) return <Card className="policy-card"><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error || 'Closeout status is unavailable.'}</p></Card>;

  const state = stateCopy(closeout.state);
  const latestIssue = closeout.active_issue ?? closeout.issues[0] ?? null;
  const canSupport = allowSupport && closeout.can_open_support && ['completed', 'cancelled'].includes(closeout.booking_status);

  return <Card className="policy-card">
    <div className="section-heading">
      <div><span className="eyebrow">Booking closeout</span><h2>Review & support handoff</h2></div>
      <Badge tone={state.tone}>{state.label}</Badge>
    </div>
    <p className="summary-note">{state.detail}</p>

    <dl className="review-details">
      <div><dt>Payment</dt><dd><Badge tone={closeout.payment_status === 'paid' ? 'success' : closeout.payment_status === 'failed' ? 'danger' : 'neutral'}>{closeout.payment_status}</Badge></dd></div>
      <div><dt>Review</dt><dd>{closeout.review ? `${closeout.review.rating}/5 · ${closeout.review.status}` : closeout.booking_status === 'completed' ? 'Not submitted yet' : 'Not available yet'}</dd></div>
      <div><dt>Support</dt><dd>{latestIssue ? `${latestIssue.status.replaceAll('_', ' ')} · ${latestIssue.category}` : 'No support case'}</dd></div>
    </dl>

    {closeout.review?.provider_response ? <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--border, #d9dce5)', borderRadius: '.8rem' }}><strong>Provider response</strong><p style={{ marginBottom: 0 }}>{closeout.review.provider_response}</p></div> : null}
    {latestIssue?.resolution_note && !closeout.active_issue ? <div style={{ marginTop: '1rem' }}><strong>Support resolution</strong><p>{latestIssue.resolution_note}</p></div> : null}

    {error ? <p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p> : null}

    {canSupport && !showSupport ? <Button type="button" variant="secondary" onClick={() => setShowSupport(true)}>Get help with this booking</Button> : null}
    {showSupport ? <div style={{ display: 'grid', gap: '.85rem', marginTop: '1rem' }}>
      <Select label="Support category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</Select>
      <Input label="Short summary" value={summary} maxLength={180} onChange={(event) => setSummary(event.target.value)} placeholder="What needs attention?" />
      <label style={{ display: 'grid', gap: '.45rem' }}><strong>Details (optional)</strong><textarea value={details} maxLength={2000} rows={4} onChange={(event) => setDetails(event.target.value)} placeholder="Add useful context for the operations team" style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit' }} /></label>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}><Button type="button" disabled={busy || summary.trim().length < 3} onClick={() => void openSupport()}>{busy ? 'Opening…' : 'Open support case'}</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => setShowSupport(false)}>Cancel</Button></div>
    </div> : null}
  </Card>;
}
