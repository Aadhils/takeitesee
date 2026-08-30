'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

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

export function RequirementJobPanel({ requirementId, requirementStatus }: { requirementId: string; requirementStatus: RequirementStatus }) {
  const { locale, t, status } = useOperationalTranslations();
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
  const money = (value: number, currency: 'INR' | 'USD') => new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  const paymentLabel = (job: RequirementJob) => {
    if (job.payment_method === 'cash_on_service') return job.payment_status === 'paid' ? t('job.cashReceived') : t('job.cashOnService');
    if (job.payment_method === 'online_gateway') return `${t('job.online')} · ${status(job.payment_status)}`;
    return t('job.paymentUnselected');
  };

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
      setNotice(`${t('job.created')}: ${payload.booking.booking_reference}.`);
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
      <div><span className="eyebrow">{t('job.eyebrow')}</span><h2>{t('job.title')}</h2></div>
      <Badge tone={liveJob ? stateTone(liveJob.state) : 'neutral'}>{liveJob ? status(liveJob.state) : t('job.notScheduled')}</Badge>
    </div>
    <p className="detail-copy">{t('job.intro')}</p>

    {error ? <Alert title={t('job.unavailable')} tone="danger">{error}</Alert> : null}
    {notice ? <Alert title={t('job.created')} tone="success">{notice}</Alert> : null}

    {loading ? <p>{t('job.loading')}</p> : null}

    {!loading && canCreate ? <form onSubmit={createJob} style={{ display: 'grid', gap: '.85rem', marginTop: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '.75rem' }}>
        <label className="field"><span className="field-label">{t('job.serviceDate')}</span><input className="field-control" type="date" min={today} required value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} /></label>
        <label className="field"><span className="field-label">{t('job.startTime')}</span><input className="field-control" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
      </div>
      <label className="field"><span className="field-label">{t('job.notes')}</span><textarea className="field-control field-textarea" rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('job.notesPlaceholder')} /></label>
      <p className="summary-note">{t('job.availabilityNote')}</p>
      <Button type="submit" loading={submitting} disabled={!bookingDate || !startTime}>{t('job.create')}</Button>
    </form> : null}

    {!loading && requirementStatus === 'awarded' && liveJob?.state === 'service_completed' ? <p className="summary-note" style={{ marginTop: '1rem' }}>{t('job.completedNote')}</p> : null}
    {!loading && requirementStatus === 'fulfilled' ? <p className="summary-note" style={{ marginTop: '1rem' }}>{t('job.fulfilledNote')}</p> : null}

    {jobs.length ? <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
      {jobs.map((job) => <div key={job.id} style={{ border: '1px solid #e7eaf0', borderRadius: '14px', padding: '.9rem' }}>
        <div className="section-heading"><div><span className="eyebrow">{t('job.job')} #{job.sequence_no}</span><h3>{job.booking_reference}</h3></div><Badge tone={stateTone(job.state)}>{status(job.state)}</Badge></div>
        <dl className="review-details">
          <div><dt>{t('common.service')}</dt><dd>{job.service_name}</dd></div>
          <div><dt>{t('common.schedule')}</dt><dd>{job.booking_date} · {String(job.start_time).slice(0,5)}</dd></div>
          <div><dt>{t('common.duration')}</dt><dd>{job.duration_minutes} {t('common.minutes')}</dd></div>
          <div><dt>{t('common.quote')}</dt><dd>{money(Number(job.quoted_price), job.currency)}</dd></div>
          <div><dt>{t('common.booking')}</dt><dd>{status(job.booking_status)}</dd></div>
          <div><dt>{t('common.payment')}</dt><dd>{paymentLabel(job)}</dd></div>
        </dl>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.75rem' }}>
          <Link className="button button-secondary" href={`/bookings/${encodeURIComponent(job.booking_id)}`}>{t('job.open')}</Link>
          <Link className="button button-quiet" href="/messages">{t('req.openChat')}</Link>
        </div>
      </div>)}
    </div> : !loading && !canCreate ? <p className="summary-note" style={{ marginTop: '1rem' }}>{t('job.afterProposal')}</p> : null}
  </Card>;
}
