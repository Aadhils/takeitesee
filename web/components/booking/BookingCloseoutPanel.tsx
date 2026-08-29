'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Input, Select } from '../ui/primitives';

type Review = { id: string; rating: number; comment?: string; status: string; provider_response?: string; provider_responded_at?: string; created_at: string };
type Issue = { id: string; category: string; summary: string; priority: string; status: string; resolution_note?: string; created_at: string; updated_at: string };
type CloseoutState = 'in_progress' | 'awaiting_review' | 'reviewed' | 'support_open' | 'support_resolved' | 'cancelled' | 'customer_no_show' | 'provider_no_show' | 'eligible_to_close' | 'closed';
type AttendanceOutcome = 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';
type Closeout = {
  booking_id: string; booking_reference: string; service_name: string; booking_status: string; payment_status: string;
  state: CloseoutState; attendance_outcome: AttendanceOutcome; review: Review | null; issues: Issue[]; active_issue: Issue | null;
  policy: { no_show_grace_minutes: number; completion_confirmation_hours: number; review_window_days: number; support_window_days: number; auto_close_days: number };
  service_completed_at?: string; customer_completion_confirmed_at?: string; customer_no_show_reported_at?: string; provider_no_show_reported_at?: string;
  no_show_available_at?: string; completion_confirmation_due_at?: string; review_due_at?: string; support_due_at?: string; close_eligible_at?: string; closed_at?: string;
  can_confirm_completion: boolean; can_report_provider_no_show: boolean; can_report_customer_no_show: boolean; can_open_support: boolean;
  review_window_open: boolean; support_window_open: boolean; completion_confirmation_overdue: boolean; close_blockers: string[];
};

const categories = ['Service quality', 'Provider no-show', 'Payment or refund', 'Safety concern', 'Other'];

function stateCopy(state: CloseoutState) {
  if (state === 'closed') return { label: 'Finally closed', tone: 'success' as const, detail: 'SLA windows are complete, payment is settled, and no active support case remains.' };
  if (state === 'eligible_to_close') return { label: 'Closeout due', tone: 'warning' as const, detail: 'The SLA window ended. Final closure is waiting for remaining blockers such as payment settlement.' };
  if (state === 'provider_no_show') return { label: 'Provider no-show', tone: 'danger' as const, detail: 'The customer reported a provider no-show and the booking is in support follow-up.' };
  if (state === 'customer_no_show') return { label: 'Customer no-show', tone: 'warning' as const, detail: 'The provider reported a customer no-show. The customer may dispute it during the support window.' };
  if (state === 'support_open') return { label: 'Support open', tone: 'warning' as const, detail: 'A support case is active, so final closeout is paused.' };
  if (state === 'support_resolved') return { label: 'Support resolved', tone: 'success' as const, detail: 'The support case is resolved; remaining SLA/payment rules still determine final closure.' };
  if (state === 'reviewed') return { label: 'Reviewed', tone: 'success' as const, detail: 'Customer feedback is recorded and no active support case remains.' };
  if (state === 'awaiting_review') return { label: 'Closeout active', tone: 'info' as const, detail: 'The service is complete and review/support windows are active.' };
  if (state === 'cancelled') return { label: 'Cancelled', tone: 'neutral' as const, detail: 'The booking is cancelled; support remains available only during the configured window.' };
  return { label: 'In progress', tone: 'neutral' as const, detail: 'Attendance and closeout actions unlock as the scheduled lifecycle progresses.' };
}

function formatMoment(value?: string) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return value; }
}

function attendanceLabel(value: AttendanceOutcome) {
  if (value === 'service_completed') return 'Service completed';
  if (value === 'customer_no_show') return 'Customer no-show';
  if (value === 'provider_no_show') return 'Provider no-show';
  return 'Pending attendance outcome';
}

export default function BookingCloseoutPanel({ bookingId, allowSupport = false, viewer = 'customer' }: { bookingId: string; allowSupport?: boolean; viewer?: 'customer' | 'provider' }) {
  const [closeout, setCloseout] = useState<Closeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSupport, setShowSupport] = useState(false);
  const [showNoShow, setShowNoShow] = useState(false);
  const [category, setCategory] = useState(categories[0]);
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [noShowNote, setNoShowNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/closeout`, { cache: 'no-store' });
      const payload = await response.json() as Closeout & { error?: string };
      if (!response.ok || !payload.booking_id) throw new Error(payload.error ?? 'Unable to load closeout state.');
      setCloseout(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load closeout state.'); }
    finally { setLoading(false); }
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

  const refreshAll = async () => {
    await load();
    window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
  };

  const openSupport = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/support`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, summary, details }),
      });
      const payload = await response.json() as { issue?: Issue; error?: string };
      if (!response.ok || !payload.issue) throw new Error(payload.error ?? 'Support case could not be opened.');
      setShowSupport(false); setSummary(''); setDetails(''); await refreshAll();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Support case could not be opened.'); }
    finally { setBusy(false); }
  };

  const attendanceAction = async (action: 'confirm_completion' | 'report_provider_no_show' | 'report_customer_no_show') => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const providerAction = action === 'report_customer_no_show';
      const url = providerAction
        ? `/api/provider/bookings/${encodeURIComponent(bookingId)}/attendance`
        : `/api/bookings/${encodeURIComponent(bookingId)}/attendance`;
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: noShowNote.trim() || undefined }),
      });
      const payload = await response.json() as Closeout & { error?: string };
      if (!response.ok || !payload.booking_id) throw new Error(payload.error ?? 'Attendance action could not be completed.');
      setCloseout(payload); setShowNoShow(false); setNoShowNote('');
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
      window.dispatchEvent(new CustomEvent('booking:provider-list-refresh', { detail: { bookingId } }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Attendance action could not be completed.'); }
    finally { setBusy(false); }
  };

  if (loading) return <Card className="policy-card"><p>Loading closeout status…</p></Card>;
  if (!closeout) return <Card className="policy-card"><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error || 'Closeout status is unavailable.'}</p></Card>;

  const state = stateCopy(closeout.state);
  const latestIssue = closeout.active_issue ?? closeout.issues[0] ?? null;
  const canSupport = viewer === 'customer' && allowSupport && closeout.can_open_support;
  const canNoShow = viewer === 'customer' ? closeout.can_report_provider_no_show : closeout.can_report_customer_no_show;

  return <Card className="policy-card">
    <div className="section-heading">
      <div><span className="eyebrow">Booking closeout & SLA</span><h2>Attendance, review, support & final closure</h2></div>
      <Badge tone={state.tone}>{state.label}</Badge>
    </div>
    <p className="summary-note">{state.detail}</p>

    <dl className="review-details">
      <div><dt>Attendance</dt><dd>{attendanceLabel(closeout.attendance_outcome)}</dd></div>
      <div><dt>Payment</dt><dd><Badge tone={closeout.payment_status === 'paid' ? 'success' : closeout.payment_status === 'failed' ? 'danger' : 'neutral'}>{closeout.payment_status}</Badge></dd></div>
      <div><dt>Completion confirmation</dt><dd>{closeout.customer_completion_confirmed_at ? `Confirmed · ${formatMoment(closeout.customer_completion_confirmed_at)}` : closeout.service_completed_at ? `${closeout.completion_confirmation_overdue ? 'Window elapsed' : 'Awaiting customer'} · due ${formatMoment(closeout.completion_confirmation_due_at)}` : 'Not applicable yet'}</dd></div>
      <div><dt>Review window</dt><dd>{closeout.review ? `${closeout.review.rating}/5 · submitted` : closeout.review_due_at ? `${closeout.review_window_open ? 'Open' : 'Ended'} · until ${formatMoment(closeout.review_due_at)}` : 'Not available yet'}</dd></div>
      <div><dt>Support window</dt><dd>{latestIssue ? `${latestIssue.status.replaceAll('_', ' ')} · ${latestIssue.category}` : closeout.support_due_at ? `${closeout.support_window_open ? 'Open' : 'Ended'} · until ${formatMoment(closeout.support_due_at)}` : 'Available during active booking'}</dd></div>
      <div><dt>Final closeout</dt><dd>{closeout.closed_at ? `Closed · ${formatMoment(closeout.closed_at)}` : closeout.close_eligible_at ? `SLA target ${formatMoment(closeout.close_eligible_at)}` : 'Not scheduled yet'}</dd></div>
    </dl>

    {closeout.review?.provider_response ? <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--border, #d9dce5)', borderRadius: '.8rem' }}><strong>Provider response</strong><p style={{ marginBottom: 0 }}>{closeout.review.provider_response}</p></div> : null}
    {latestIssue?.resolution_note && !closeout.active_issue ? <div style={{ marginTop: '1rem' }}><strong>Support resolution</strong><p>{latestIssue.resolution_note}</p></div> : null}
    {closeout.close_blockers.length && closeout.state === 'eligible_to_close' ? <p className="summary-note">Closeout blockers: {closeout.close_blockers.map((item) => item.replaceAll('_', ' ')).join(', ')}.</p> : null}
    {error ? <p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p> : null}

    <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>
      {viewer === 'customer' && closeout.can_confirm_completion ? <Button type="button" disabled={busy} onClick={() => void attendanceAction('confirm_completion')}>{busy ? 'Updating…' : 'Confirm service completed'}</Button> : null}
      {canNoShow && !showNoShow ? <Button type="button" variant="secondary" disabled={busy} onClick={() => setShowNoShow(true)}>{viewer === 'customer' ? 'Report provider no-show' : 'Mark customer no-show'}</Button> : null}
      {canSupport && !showSupport ? <Button type="button" variant="secondary" onClick={() => setShowSupport(true)}>Get help with this booking</Button> : null}
    </div>

    {showNoShow ? <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
      <label style={{ display: 'grid', gap: '.45rem' }}><strong>No-show details (optional)</strong><textarea value={noShowNote} maxLength={1000} rows={3} onChange={(event) => setNoShowNote(event.target.value)} placeholder="Add useful attendance context" style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit' }} /></label>
      <p className="summary-note">This records a formal attendance outcome after the {closeout.policy.no_show_grace_minutes}-minute grace period. Any disagreement must go through support.</p>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}><Button type="button" disabled={busy} onClick={() => void attendanceAction(viewer === 'customer' ? 'report_provider_no_show' : 'report_customer_no_show')}>{busy ? 'Recording…' : viewer === 'customer' ? 'Report no-show' : 'Mark no-show'}</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => setShowNoShow(false)}>Cancel</Button></div>
    </div> : null}

    {showSupport ? <div style={{ display: 'grid', gap: '.85rem', marginTop: '1rem' }}>
      <Select label="Support category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</Select>
      <Input label="Short summary" value={summary} maxLength={180} onChange={(event) => setSummary(event.target.value)} placeholder="What needs attention?" />
      <label style={{ display: 'grid', gap: '.45rem' }}><strong>Details (optional)</strong><textarea value={details} maxLength={2000} rows={4} onChange={(event) => setDetails(event.target.value)} placeholder="Add useful context for the operations team" style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit' }} /></label>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}><Button type="button" disabled={busy || summary.trim().length < 3} onClick={() => void openSupport()}>{busy ? 'Opening…' : 'Open support case'}</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => setShowSupport(false)}>Cancel</Button></div>
    </div> : null}
  </Card>;
}
