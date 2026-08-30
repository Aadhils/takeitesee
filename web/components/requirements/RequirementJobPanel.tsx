'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';

type RequirementStatus = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
type JobState = 'active' | 'declined' | 'cancelled' | 'service_completed' | 'fulfilled';
type RequirementJob = {
  id: string;
  sequence_no: number;
  state: JobState;
  created_at: string;
  booking_id: string;
  booking_reference: string;
  booking_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method: 'unselected' | 'online_gateway' | 'cash_on_service';
  cash_collected_at: string | null;
  booking_date: string;
  start_time: string;
  timezone: string;
  duration_minutes: number;
  location: string;
  quoted_price: number;
  currency: 'INR' | 'USD';
  service_name: string;
};

type CreateResponse = {
  job?: { id: string };
  booking?: { id: string; booking_reference: string };
  error?: string;
};

function stateTone(state: JobState) {
  if (state === 'active') return 'info' as const;
  if (state === 'service_completed') return 'warning' as const;
  if (state === 'fulfilled') return 'success' as const;
  if (state === 'cancelled' || state === 'declined') return 'danger' as const;
  return 'neutral' as const;
}

function money(value: number, currency: 'INR' | 'USD') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function paymentLabel(job: RequirementJob) {
  if (job.payment_method === 'cash_on_service') {
    return job.payment_status === 'paid' ? 'Cash received' : 'Cash on Service';
  }
  if (job.payment_method === 'online_gateway') return `Online · ${job.payment_status}`;
  return 'Payment method not selected';
}

export function RequirementJobPanel({ requirementId, requirementStatus }: { requirementId: string; requirementStatus: RequirementStatus }) {
  const [jobs, setJobs] = useState<RequirementJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const liveJob = jobs.find((job) => ['active', 'service_completed', 'fulfilled'].includes(job.state));
  const canCreate = requirementStatus === 'awarded' && !liveJob;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}/job`, { cache: 'no-store' });
      const payload = await response.json() as { jobs?: RequirementJob[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Service job history could not be loaded.');
      setJobs(payload.jobs ?? []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Service job history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [requirementId]);

  useEffect(() => { void load(); }, [load]);

  const createJob = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate || submitting) return;
    setSubmitting(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}/job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_date: bookingDate, start_time: startTime, notes }),
      });
      const payload = await response.json() as CreateResponse;
      if (!response.ok || !payload.booking) throw new Error(payload.error || 'Service job could not be created.');
      setNotice(`Service job ${payload.booking.booking_reference} created. The provider can now confirm the scheduled booking.`);
      setBookingDate(''); setStartTime(''); setNotes('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Service job could not be created.');
    } finally {
      setSubmitting(false);
    }
  };

  return <Card className="policy-card">
    <div className="section-heading">
      <div><span className="eyebrow">Service job</span><h2>Turn the awarded requirement into a booking</h2></div>
      <Badge tone={liveJob ? stateTone(liveJob.state) : 'neutral'}>{liveJob ? liveJob.state.replace('_', ' ') : 'Not scheduled'}</Badge>
    </div>
    <p className="detail-copy">The accepted proposal becomes a normal Takeitesee booking. Provider confirmation, rescheduling, Cash on Service, completion, closeout and review all use the existing booking lifecycle.</p>

    {error ? <Alert title="Service job unavailable" tone="danger">{error}</Alert> : null}
    {notice ? <Alert title="Service job created" tone="success">{notice}</Alert> : null}

    {loading ? <p>Loading service job history…</p> : null}

    {!loading && canCreate ? <form onSubmit={createJob} style={{ display: 'grid', gap: '.85rem', marginTop: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '.75rem' }}>
        <label className="field"><span className="field-label">Service date</span><input className="field-control" type="date" min={today} required value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} /></label>
        <label className="field"><span className="field-label">Start time</span><input className="field-control" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
      </div>
      <label className="field"><span className="field-label">Job notes (optional)</span><textarea className="field-control field-textarea" rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add access details or anything agreed in chat." /></label>
      <p className="summary-note">Only provider availability is accepted. Blocked hours, blackouts and overlapping bookings are rejected automatically.</p>
      <Button type="submit" loading={submitting} disabled={!bookingDate || !startTime}>Create service job</Button>
    </form> : null}

    {!loading && requirementStatus === 'awarded' && liveJob?.state === 'service_completed' ? <p className="summary-note" style={{ marginTop: '1rem' }}>Service is marked completed. The requirement will close automatically after customer completion confirmation and payment settlement.</p> : null}
    {!loading && requirementStatus === 'fulfilled' ? <p className="summary-note" style={{ marginTop: '1rem' }}>This requirement was fulfilled through the linked service job lifecycle.</p> : null}

    {jobs.length ? <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
      {jobs.map((job) => <div key={job.id} style={{ border: '1px solid #e7eaf0', borderRadius: '14px', padding: '.9rem' }}>
        <div className="section-heading"><div><span className="eyebrow">Job #{job.sequence_no}</span><h3>{job.booking_reference}</h3></div><Badge tone={stateTone(job.state)}>{job.state.replace('_', ' ')}</Badge></div>
        <dl className="review-details">
          <div><dt>Service</dt><dd>{job.service_name}</dd></div>
          <div><dt>Schedule</dt><dd>{job.booking_date} · {String(job.start_time).slice(0,5)}</dd></div>
          <div><dt>Duration</dt><dd>{job.duration_minutes} min</dd></div>
          <div><dt>Quote</dt><dd>{money(Number(job.quoted_price), job.currency)}</dd></div>
          <div><dt>Booking</dt><dd>{job.booking_status}</dd></div>
          <div><dt>Payment</dt><dd>{paymentLabel(job)}</dd></div>
        </dl>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.75rem' }}>
          <Link className="button button-secondary" href={`/bookings/${encodeURIComponent(job.booking_id)}`}>Open service job</Link>
          <Link className="button button-quiet" href="/messages">Open private chat</Link>
        </div>
      </div>)}
    </div> : !loading && !canCreate ? <p className="summary-note" style={{ marginTop: '1rem' }}>A service job becomes available after a provider proposal is accepted.</p> : null}
  </Card>;
}
