'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

type RequirementSummary = {
  id: string;
  status: 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
  schedule_pattern: 'one_time' | 'recurring';
};
type JobSummary = {
  id: string;
  sequence_no: number;
  state: 'active' | 'declined' | 'cancelled' | 'service_completed' | 'fulfilled';
  booking_id: string;
  booking_reference: string;
  booking_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
  booking_date: string;
  start_time: string;
};
type PlannedOccurrence = {
  sequence_no: number;
  scheduled_date: string | null;
  preferred_start_time: string | null;
};
type OccurrencePlan = {
  schedule_pattern: 'one_time' | 'recurring';
  occurrences: PlannedOccurrence[];
};
type RecoveryRecord = {
  id: string;
  sequence_no: number;
  status: 'initiated' | 'completed';
  prior_booking_id: string;
  replacement_booking_id: string | null;
  created_at: string;
};
type RecoveryReadModel = {
  requirement?: RequirementSummary;
  jobs?: JobSummary[];
  occurrence_plan?: OccurrencePlan | null;
  recoveries?: RecoveryRecord[];
  error?: string;
};
type RecoveryResponse = {
  recovery?: { sequence_no: number };
  booking?: { id: string; booking_reference: string };
  error?: string;
};

export function RequirementOccurrenceRecoveryPanel({ requirementId, onRecovered }: { requirementId: string; onRecovered: () => void }) {
  const { locale, status } = useOperationalTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [requirement, setRequirement] = useState<RequirementSummary | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [occurrencePlan, setOccurrencePlan] = useState<OccurrencePlan | null>(null);
  const [recoveries, setRecoveries] = useState<RecoveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');

  const latestJob = useMemo(() => jobs.reduce<JobSummary | null>((latest, job) => !latest || job.sequence_no > latest.sequence_no ? job : latest, null), [jobs]);
  const liveJob = jobs.find((job) => ['active', 'service_completed'].includes(job.state));
  const recoverableJob = requirement?.status === 'awarded'
    && requirement.schedule_pattern === 'recurring'
    && !liveJob
    && latestJob
    && ['cancelled', 'declined'].includes(latestJob.state)
      ? latestJob
      : null;
  const recoverableOccurrence = recoverableJob
    ? occurrencePlan?.occurrences.find((occurrence) => occurrence.sequence_no === recoverableJob.sequence_no) ?? null
    : null;
  const canRecover = Boolean(recoverableJob && recoverableJob.booking_status === 'cancelled' && recoverableJob.payment_status === 'unpaid');
  const finalReadOnly = requirement?.status === 'fulfilled';
  const minimumDate = useMemo(() => {
    const planned = recoverableOccurrence?.scheduled_date;
    return planned && planned > today ? planned : today;
  }, [recoverableOccurrence?.scheduled_date, today]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}/recovery`, { cache: 'no-store' });
      const payload = await response.json() as RecoveryReadModel;
      if (!response.ok || !payload.requirement) throw new Error(payload.error || 'Occurrence recovery details could not be loaded.');
      setRequirement(payload.requirement);
      setJobs(payload.jobs ?? []);
      setOccurrencePlan(payload.occurrence_plan ?? null);
      setRecoveries(payload.recoveries ?? []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Occurrence recovery details could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [requirementId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!canRecover || !recoverableJob) return;
    setBookingDate((current) => current || minimumDate);
    setStartTime((current) => current || (recoverableOccurrence?.preferred_start_time ? String(recoverableOccurrence.preferred_start_time).slice(0, 5) : String(recoverableJob.start_time).slice(0, 5)));
  }, [canRecover, minimumDate, recoverableJob, recoverableOccurrence?.preferred_start_time]);

  const retryOccurrence = async (event: FormEvent) => {
    event.preventDefault();
    if (!canRecover || !recoverableJob || recovering) return;
    setRecovering(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/requirements/${encodeURIComponent(requirementId)}/recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_date: bookingDate, start_time: startTime, notes }),
      });
      const payload = await response.json() as RecoveryResponse;
      if (!response.ok || !payload.recovery || !payload.booking) throw new Error(payload.error || 'Recurring occurrence could not be recovered.');
      setNotice(tamil
        ? `Occurrence #${payload.recovery.sequence_no} மீண்டும் booking செய்யப்பட்டது: ${payload.booking.booking_reference}.`
        : `Occurrence #${payload.recovery.sequence_no} was rebooked: ${payload.booking.booking_reference}.`);
      setBookingDate(''); setStartTime(''); setNotes('');
      await load();
      onRecovered();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Recurring occurrence could not be recovered.');
    } finally {
      setRecovering(false);
    }
  };

  if (loading) return null;
  if (error && !requirement) return <Card className="policy-card"><Alert title={tamil ? 'Occurrence recovery கிடைக்கவில்லை' : 'Occurrence recovery unavailable'} tone="danger">{error}</Alert></Card>;
  if (!requirement || requirement.schedule_pattern !== 'recurring') return null;

  return <Card className="policy-card">
    <div className="section-heading">
      <div><span className="eyebrow">Occurrence recovery</span><h2>{finalReadOnly ? (tamil ? 'Recurring occurrence recovery history' : 'Recurring occurrence recovery history') : (tamil ? 'Recurring occurrence retry & history' : 'Recurring occurrence retry & history')}</h2></div>
      <Badge tone="neutral">{recoveries.length}</Badge>
    </div>
    <p className="detail-copy">{finalReadOnly
      ? (tamil ? 'இந்த recurring requirement முழுமையாக fulfilled. முந்தைய recovery records audit/history ஆக read-only நிலையில் பாதுகாக்கப்படுகின்றன.' : 'This recurring requirement is fully fulfilled. Previous recovery records remain available as read-only audit history.')
      : (tamil ? 'Failed recurring occurrence-ஐ அடுத்த sequence-க்கு skip செய்யாமல் அதே occurrence number-ல் மீண்டும் booking செய்யலாம்.' : 'Retry a failed recurring occurrence at the same sequence number without skipping ahead.')}</p>

    {error ? <Alert title={tamil ? 'Recovery update தோல்வி' : 'Recovery update failed'} tone="danger">{error}</Alert> : null}
    {notice ? <Alert title={tamil ? 'Occurrence recovered' : 'Occurrence recovered'} tone="success">{notice}</Alert> : null}
    {finalReadOnly ? <Alert title={tamil ? 'Recurring service completed' : 'Recurring service completed'} tone="success">{tamil ? 'அனைத்து planned occurrences-மும் முடிந்துவிட்டன. புதிய recovery retry action கிடையாது; history மட்டும் பார்க்கலாம்.' : 'All planned occurrences are complete. No further recovery retry action is available; the history remains viewable.'}</Alert> : null}

    {recoverableJob ? <div style={{ display: 'grid', gap: '.8rem', marginTop: '1rem', border: '1px solid #ececf2', borderRadius: '14px', padding: '1rem' }}>
      <div className="section-heading"><div><span className="eyebrow">{recoverableJob.booking_reference}</span><h3>{tamil ? `Occurrence #${recoverableJob.sequence_no} retry` : `Retry occurrence #${recoverableJob.sequence_no}`}</h3></div><Badge tone="danger">{status(recoverableJob.state)}</Badge></div>
      {recoverableJob.booking_status !== 'cancelled' ? <p className="summary-note">{tamil ? 'இந்த occurrence booking முதலில் cancelled நிலையில் இருக்க வேண்டும்.' : 'The occurrence booking must be cancelled before it can be retried.'}</p> : recoverableJob.payment_status !== 'unpaid' ? <p className="summary-note">{tamil ? 'இந்த cancelled occurrence-ல் payment activity உள்ளது. Automatic retry block செய்யப்பட்டுள்ளது; support review தேவை.' : 'This cancelled occurrence has payment activity. Automatic retry is blocked and support review is required.'}</p> : <form onSubmit={retryOccurrence} style={{ display: 'grid', gap: '.85rem' }}>
        <p className="summary-note">{tamil ? 'Backend மீண்டும் schedule, selected weekdays, provider availability, blackout மற்றும் overlap checks அனைத்தையும் validate செய்யும்.' : 'The backend revalidates schedule, selected weekdays, provider availability, blackout and overlap checks.'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '.75rem' }}>
          <label className="field"><span className="field-label">{tamil ? 'Recovery service date' : 'Recovery service date'}</span><input className="field-control" type="date" min={minimumDate} required value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} /></label>
          <label className="field"><span className="field-label">{tamil ? 'Recovery start time' : 'Recovery start time'}</span><input className="field-control" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
        </div>
        <label className="field"><span className="field-label">{tamil ? 'Recovery notes' : 'Recovery notes'}</span><textarea className="field-control field-textarea" rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={tamil ? 'Optional retry notes' : 'Optional retry notes'} /></label>
        <Button type="submit" loading={recovering} disabled={!bookingDate || !startTime}>{tamil ? 'இந்த occurrence-ஐ மீண்டும் booking செய்' : 'Retry this occurrence'}</Button>
      </form>}
    </div> : requirement.status === 'awarded' && latestJob && !liveJob && latestJob.state !== 'fulfilled' ? <p className="summary-note" style={{ marginTop: '1rem' }}>{tamil ? 'இந்த occurrence தற்போது automatic recovery-க்கு eligible இல்லை.' : 'This occurrence is not currently eligible for automatic recovery.'}</p> : null}

    <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
      <div className="section-heading"><div><span className="eyebrow">Recovery audit</span><h3>{tamil ? 'Occurrence recovery history' : 'Occurrence recovery history'}</h3></div><Badge tone="info">{recoveries.length}</Badge></div>
      {recoveries.length === 0 ? <p className="summary-note">{tamil ? 'இதுவரை occurrence recovery இல்லை.' : 'No occurrence recovery has been recorded yet.'}</p> : recoveries.map((recovery) => <div key={recovery.id} style={{ border: '1px solid #ececf2', borderRadius: '12px', padding: '.75rem' }}>
        <div className="section-heading"><strong>Occurrence #{recovery.sequence_no}</strong><Badge tone={recovery.status === 'completed' ? 'success' : 'warning'}>{status(recovery.status)}</Badge></div>
        <p className="summary-note">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(recovery.created_at))}</p>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.6rem' }}>
          <Link className="button button-quiet" href={`/bookings/${encodeURIComponent(recovery.prior_booking_id)}`}>{tamil ? 'முந்தைய cancelled booking' : 'Prior cancelled booking'}</Link>
          {recovery.replacement_booking_id ? <Link className="button button-secondary" href={`/bookings/${encodeURIComponent(recovery.replacement_booking_id)}`}>{tamil ? 'Replacement booking' : 'Replacement booking'}</Link> : null}
        </div>
      </div>)}
    </div>
  </Card>;
}
