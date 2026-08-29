'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import BookingAuditTimeline from '../booking/BookingAuditTimeline';
import { Badge, Button, Card, Select } from '../ui/primitives';
import { AdminHeading, AdminShell } from './AdminPresentation';

type Issue = {
  id: string; booking_id: string; service_id: string; reported_by: string; category: string; summary: string; details?: string | null;
  priority: string; status: string; resolution_note?: string | null; handled_by?: string | null; created_at: string; updated_at: string; resolved_at?: string | null;
};
type Booking = {
  id: string; booking_reference: string; service_name_snapshot: string; booking_date: string; start_time: string; timezone: string;
  status: string; payment_status: string; quoted_price: number | string; currency: string;
};
type Reporter = { id: string; name?: string | null; email?: string | null };
type IssueEvent = { id: string; actor_type: string; event_type: string; from_status?: string | null; to_status?: string | null; note?: string | null; created_at: string };
type Payload = { issue: Issue; booking?: Booking | null; reporter?: Reporter | null; events: IssueEvent[] };

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'resolved' || status === 'closed') return 'success';
  if (status === 'investigating' || status === 'awaiting_information') return 'warning';
  if (status === 'open') return 'info';
  return 'neutral';
}

export default function AdminLiveIssueDetail({ issueId }: { issueId: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [status, setStatus] = useState('investigating');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setError('');
      const response = await fetch(`/api/admin/issues/${encodeURIComponent(issueId)}`, { cache: 'no-store' });
      const body = await response.json() as Payload & { error?: string };
      if (!response.ok || !body.issue) throw new Error(body.error ?? 'Unable to load support case.');
      setPayload(body);
      setStatus(body.issue.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load support case.');
    }
  };

  useEffect(() => { void load(); }, [issueId]);

  const update = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/issues/${encodeURIComponent(issueId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, note }),
      });
      const body = await response.json() as Payload & { error?: string };
      if (!response.ok || !body.issue) throw new Error(body.error ?? 'Unable to update support case.');
      setPayload(body);
      setNote('');
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId: body.issue.booking_id } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update support case.');
    } finally { setBusy(false); }
  };

  return <AdminShell active="/admin/disputes">
    <AdminHeading eyebrow="Support operations" title={payload?.issue.category ?? 'Support case'} description="Review the customer concern, linked booking lifecycle, and scoped resolution history." action={<Link href="/admin/disputes" className="button button-secondary">Back to issues</Link>} />
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {!payload ? <Card><p>{error ? 'Support case could not be loaded.' : 'Loading support case…'}</p></Card> : <>
      <div className="admin-detail-grid">
        <Card className="admin-detail-card">
          <div className="admin-record-top"><div><span className="eyebrow">{payload.booking?.booking_reference ?? payload.issue.id}</span><h2>{payload.issue.summary}</h2></div><Badge tone={statusTone(payload.issue.status)}>{payload.issue.status.replaceAll('_', ' ')}</Badge></div>
          <p>{payload.issue.details || 'No additional customer details were provided.'}</p>
          <dl className="admin-detail-list">
            <div><dt>Customer</dt><dd>{payload.reporter?.name || payload.reporter?.email || 'Customer'}</dd></div>
            <div><dt>Service</dt><dd>{payload.booking?.service_name_snapshot || 'Scoped service'}</dd></div>
            <div><dt>Booking state</dt><dd>{payload.booking?.status || '—'}</dd></div>
            <div><dt>Payment</dt><dd>{payload.booking?.payment_status || '—'}</dd></div>
            <div><dt>Priority</dt><dd>{payload.issue.priority}</dd></div>
          </dl>
          {payload.issue.resolution_note ? <><strong>Latest resolution note</strong><p>{payload.issue.resolution_note}</p></> : null}
        </Card>

        <Card className="admin-detail-card">
          <span className="eyebrow">Operations decision</span><h2>Update support case</h2>
          <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="open">Open</option><option value="investigating">Investigating</option><option value="awaiting_information">Awaiting information</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
          </Select>
          <label style={{ display: 'grid', gap: '.45rem', marginTop: '.8rem' }}><strong>{['resolved','closed'].includes(status) ? 'Resolution note' : 'Operations note (optional)'}</strong><textarea rows={5} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain the action or resolution clearly" style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit' }} /></label>
          <Button type="button" disabled={busy || (['resolved','closed'].includes(status) && note.trim().length < 3)} onClick={() => void update()}>{busy ? 'Saving…' : 'Save support update'}</Button>
        </Card>
      </div>

      <Card className="admin-detail-card">
        <span className="eyebrow">Support history</span><h2>Case activity</h2>
        {payload.events.length ? <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '.8rem' }}>{payload.events.map((event) => <li key={event.id} style={{ borderLeft: '3px solid var(--border, #d9dce5)', paddingLeft: '1rem' }}><strong>{event.event_type.replaceAll('_', ' ')}</strong><p style={{ margin: '.25rem 0' }}>{event.note || `${event.from_status || 'new'} → ${event.to_status || payload.issue.status}`}</p><small>{new Date(event.created_at).toLocaleString('en-IN')}</small></li>)}</ol> : <p>No support history has been recorded yet.</p>}
      </Card>

      {payload.booking ? <BookingAuditTimeline bookingId={payload.booking.id} refreshKey={payload.issue.updated_at} title="Linked booking closeout timeline" description="Booking, payment, review, and support events are shown together for operations context." /> : null}
    </>}
  </AdminShell>;
}
