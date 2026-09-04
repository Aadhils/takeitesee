'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

type RequirementStatus = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
type JobState = 'active' | 'declined' | 'cancelled' | 'service_completed' | 'fulfilled';
type PricingBasis = 'per_occurrence' | 'whole_requirement';
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
type PlannedOccurrence = {
  sequence_no: number;
  scheduled_date: string | null;
  preferred_start_time: string | null;
  expected_duration_minutes: number | null;
  job_id: string | null;
  job_state: JobState | null;
  booking_id: string | null;
  booking_reference: string | null;
  booking_status: string | null;
  booked_date: string | null;
  booked_start_time: string | null;
};
type OccurrencePlan = {
  schedule_pattern: 'one_time' | 'recurring';
  recurrence_frequency: 'daily' | 'weekly' | 'monthly' | null;
  recurrence_interval: number | null;
  occurrence_count: number;
  pricing_basis: PricingBasis;
  quote_amount_minor: number | null;
  currency: 'INR' | 'USD' | null;
  occurrences: PlannedOccurrence[];
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
  const [occurrencePlan, setOccurrencePlan] = useState<OccurrencePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');

  const tamil = locale.toLowerCase().startsWith('ta');
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const liveJob = jobs.find((job) => ['active', 'service_completed'].includes(job.state));
  const latestJob = useMemo(() => jobs.reduce<RequirementJob | null>((latest, job) => !latest || job.sequence_no > latest.sequence_no ? job : latest, null), [jobs]);
  const nextOccurrence = useMemo(() => occurrencePlan?.occurrences.find((occurrence) => !occurrence.job_id) ?? null, [occurrencePlan]);
  const recurringCanAdvance = occurrencePlan?.schedule_pattern !== 'recurring' || !latestJob || latestJob.state === 'fulfilled';
  const canCreate = requirementStatus === 'awarded' && !liveJob && recurringCanAdvance && Boolean(nextOccurrence);
  const panelStatus = requirementStatus === 'fulfilled'
    ? { tone: 'success' as const, label: status('fulfilled') }
    : liveJob
      ? { tone: stateTone(liveJob.state), label: status(liveJob.state) }
      : { tone: 'neutral' as const, label: t('job.notScheduled') };
  const minimumBookingDate = useMemo(() => {
    const planned = occurrencePlan?.schedule_pattern === 'recurring' ? nextOccurrence?.scheduled_date : null;
    return planned && planned > today ? planned : today;
  }, [nextOccurrence, occurrencePlan?.schedule_pattern, today]);
  const money = (value: number, currency: 'INR' | 'USD') => new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  const paymentLabel = (job: RequirementJob) => {
    if (job.payment_method === 'cash_on_service') return job.payment_status === 'paid' ? t('job.cashReceived') : t('job.cashOnService');
    if (job.payment_method === 'online_gateway') return `${t('job.online')} · ${status(job.payment_status)}`;
    return t('job.paymentUnselected');
  };
  const pricingBasisLabel = (basis: PricingBasis) => basis === 'whole_requirement'
    ? (tamil ? 'முழு recurring requirement-க்கு மொத்த quote' : 'Total for the whole recurring requirement')
    : (tamil ? 'ஒவ்வொரு service occurrence-க்கும்' : 'Per service occurrence');
  const occurrenceQuote = (sequenceNo: number) => {
    if (!occurrencePlan?.quote_amount_minor || !occurrencePlan.currency) return null;
    if (occurrencePlan.pricing_basis === 'per_occurrence' || occurrencePlan.schedule_pattern !== 'recurring') return occurrencePlan.quote_amount_minor;
    const base = Math.floor(occurrencePlan.quote_amount_minor / occurrencePlan.occurrence_count);
    return sequenceNo === occurrencePlan.occurrence_count
      ? occurrencePlan.quote_amount_minor - base * (occurrencePlan.occurrence_count - 1)
      : base;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}/job`, { cache: 'no-store' });
      const payload = await response.json() as { jobs?: RequirementJob[]; occurrence_plan?: OccurrencePlan | null; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Service job history could not be loaded.');
      setJobs(payload.jobs ?? []);
      setOccurrencePlan(payload.occurrence_plan ?? null);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Service job history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [requirementId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!canCreate || occurrencePlan?.schedule_pattern !== 'recurring' || !nextOccurrence) return;
    setBookingDate((current) => current || nextOccurrence.scheduled_date || '');
    setStartTime((current) => current || (nextOccurrence.preferred_start_time ? String(nextOccurrence.preferred_start_time).slice(0, 5) : ''));
  }, [canCreate, nextOccurrence, occurrencePlan?.schedule_pattern]);

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
      <Badge tone={panelStatus.tone}>{panelStatus.label}</Badge>
    </div>
    <p className="detail-copy">{t('job.intro')}</p>

    {error ? <Alert title={t('job.unavailable')} tone="danger">{error}</Alert> : null}
    {notice ? <Alert title={t('job.created')} tone="success">{notice}</Alert> : null}

    {loading ? <p>{t('job.loading')}</p> : null}

    {!loading && occurrencePlan?.schedule_pattern === 'recurring' ? <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
      <div className="section-heading"><div><span className="eyebrow">Recurring plan</span><h3>{tamil ? 'திட்டமிட்ட service occurrences' : 'Planned service occurrences'}</h3></div><Badge tone="info">{occurrencePlan.occurrence_count}</Badge></div>
      <p className="summary-note">{pricingBasisLabel(occurrencePlan.pricing_basis)}{occurrencePlan.quote_amount_minor != null && occurrencePlan.currency ? ` · ${money(Number(occurrencePlan.quote_amount_minor) / 100, occurrencePlan.currency)}` : ''}</p>
      <div style={{ display: 'grid', gap: '.55rem' }}>
        {occurrencePlan.occurrences.map((occurrence) => { const quoteMinor = occurrenceQuote(occurrence.sequence_no); return <div key={occurrence.sequence_no} style={{ border: '1px solid #ececf2', borderRadius: '12px', padding: '.75rem' }}>
          <div className="section-heading"><strong>Occurrence #{occurrence.sequence_no}</strong>{occurrence.job_state ? <Badge tone={stateTone(occurrence.job_state)}>{status(occurrence.job_state)}</Badge> : <Badge tone="neutral">{tamil ? 'திட்டமிடப்பட்டது' : 'Planned'}</Badge>}</div>
          <p className="summary-note">{occurrence.scheduled_date || t('common.flexible')}{occurrence.preferred_start_time ? ` · ${String(occurrence.preferred_start_time).slice(0,5)}` : ''}{occurrence.expected_duration_minutes ? ` · ${occurrence.expected_duration_minutes} ${t('common.minutes')}` : ''}{quoteMinor != null && occurrencePlan.currency ? ` · ${money(quoteMinor / 100, occurrencePlan.currency)}` : ''}</p>
          {occurrence.booking_reference ? <p className="summary-note">{t('common.booking')}: {occurrence.booking_reference}</p> : null}
        </div>; })}
      </div>
      <p className="summary-note">{requirementStatus === 'fulfilled'
        ? (tamil ? 'அனைத்து திட்டமிட்ட occurrences-மும் முழுமையாக முடிந்துள்ளன. இந்த occurrence history இப்போது read-only.' : 'All planned occurrences are fully complete. This occurrence history is now read-only.')
        : (tamil ? 'ஒவ்வொரு occurrence-மும் முந்தைய occurrence முழுமையாக complete மற்றும் settle ஆன பிறகே அடுத்த booking ஆக உருவாக்கப்படும்.' : 'Each occurrence is booked only after the previous occurrence is fully completed and settled.')}</p>
    </div> : null}

    {!loading && canCreate ? <form onSubmit={createJob} style={{ display: 'grid', gap: '.85rem', marginTop: '1rem' }}>
      {occurrencePlan?.schedule_pattern === 'recurring' && nextOccurrence ? <p className="summary-note">{tamil ? `அடுத்த occurrence #${nextOccurrence.sequence_no}` : `Next occurrence #${nextOccurrence.sequence_no}`}{nextOccurrence.scheduled_date ? ` · ${nextOccurrence.scheduled_date}` : ''}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '.75rem' }}>
        <label className="field"><span className="field-label">{t('job.serviceDate')}</span><input className="field-control" type="date" min={minimumBookingDate} required value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} /></label>
        <label className="field"><span className="field-label">{t('job.startTime')}</span><input className="field-control" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
      </div>
      <label className="field"><span className="field-label">{t('job.notes')}</span><textarea className="field-control field-textarea" rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('job.notesPlaceholder')} /></label>
      <p className="summary-note">{t('job.availabilityNote')}</p>
      <Button type="submit" loading={submitting} disabled={!bookingDate || !startTime}>{t('job.create')}</Button>
    </form> : null}

    {!loading && requirementStatus === 'awarded' && liveJob?.state === 'service_completed' ? <p className="summary-note" style={{ marginTop: '1rem' }}>{t('job.completedNote')}</p> : null}
    {!loading && requirementStatus === 'awarded' && occurrencePlan?.schedule_pattern === 'recurring' && latestJob && !liveJob && latestJob.state !== 'fulfilled' ? <p className="summary-note" style={{ marginTop: '1rem' }}>{tamil ? 'அடுத்த occurrence உருவாக்க, முந்தைய occurrence complete மற்றும் settle ஆக வேண்டும்.' : 'The previous occurrence must be completed and settled before the next one can be booked.'}</p> : null}
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