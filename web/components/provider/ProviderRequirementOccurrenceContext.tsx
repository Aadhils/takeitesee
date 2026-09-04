'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Card } from '../ui/primitives';

type RequirementStatus = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
type JobState = 'active' | 'declined' | 'cancelled' | 'service_completed' | 'fulfilled';
type RequirementContext = {
  requirement_id: string;
  requirement_title: string;
  requirement_status: RequirementStatus;
  job_state: JobState;
  schedule_pattern: 'one_time' | 'recurring';
  occurrence_number: number;
  occurrence_count: number;
  recurrence_frequency: 'daily' | 'weekly' | 'monthly' | null;
  recurrence_interval: number | null;
  recurrence_weekdays: number[] | null;
  pricing_basis: 'per_occurrence' | 'whole_requirement' | null;
  recovery: {
    id: string;
    attempt_number: number;
    prior_booking_id: string;
    prior_booking_reference: string;
    recovered_at: string;
  } | null;
};

const WEEKDAY_NAMES = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ta: ['ஞாயி', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'],
} as const;

export default function ProviderRequirementOccurrenceContext({ bookingId, locale }: { bookingId: string; locale: string }) {
  const [context, setContext] = useState<RequirementContext | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}/requirement-context`, { cache: 'no-store' });
        const payload = await response.json() as { context?: RequirementContext | null; error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Unable to load requirement context.');
        if (active) setContext(payload.context ?? null);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load requirement context.');
      }
    })();
    return () => { active = false; };
  }, [bookingId]);

  if (!context) return error ? <Card><p role="status" className="summary-note">{error}</p></Card> : null;
  const tamil = locale.toLowerCase().startsWith('ta');
  const recurring = context.schedule_pattern === 'recurring';
  const weekdays = context.recurrence_frequency === 'weekly' && context.recurrence_weekdays?.length
    ? context.recurrence_weekdays.map((value) => (tamil ? WEEKDAY_NAMES.ta : WEEKDAY_NAMES.en)[value] ?? String(value)).join(', ')
    : null;
  const cadence = recurring && context.recurrence_frequency
    ? `${context.recurrence_interval && context.recurrence_interval > 1 ? `${context.recurrence_interval} × ` : ''}${context.recurrence_frequency}${weekdays ? ` · ${weekdays}` : ''}`
    : null;
  const pricing = context.pricing_basis === 'whole_requirement'
    ? (tamil ? 'முழு requirement-க்கான quote' : 'Quote covers the whole requirement')
    : (tamil ? 'ஒவ்வொரு occurrence-க்கும் quote' : 'Quote is per occurrence');
  const lifecycle = context.requirement_status === 'fulfilled'
    ? { tone: 'success' as const, label: tamil ? 'Requirement நிறைவு' : 'Requirement fulfilled' }
    : context.requirement_status === 'cancelled'
      ? { tone: 'danger' as const, label: tamil ? 'Requirement ரத்து' : 'Requirement cancelled' }
      : context.job_state === 'fulfilled'
        ? { tone: 'success' as const, label: tamil ? 'Occurrence நிறைவு' : 'Occurrence fulfilled' }
        : context.job_state === 'service_completed'
          ? { tone: 'warning' as const, label: tamil ? 'சேவை முடிந்தது' : 'Service completed' }
          : context.job_state === 'cancelled' || context.job_state === 'declined'
            ? { tone: 'danger' as const, label: tamil ? 'Occurrence நிறுத்தப்பட்டது' : 'Occurrence stopped' }
            : { tone: 'info' as const, label: tamil ? 'Occurrence செயலில்' : 'Occurrence active' };

  return <Card className="provider-detail-card">
    <div className="section-heading">
      <div><span className="eyebrow">{tamil ? 'Requirement வேலை' : 'Requirement job'}</span><h2>{context.requirement_title}</h2></div>
      <div style={{ display: 'flex', gap: '.45rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Badge tone={recurring ? 'info' : 'neutral'}>{recurring ? 'Recurring' : (tamil ? 'ஒருமுறை' : 'One time')}</Badge>
        <Badge tone={lifecycle.tone}>{lifecycle.label}</Badge>
      </div>
    </div>
    {recurring ? <p><strong>Occurrence #{context.occurrence_number}</strong> / {context.occurrence_count}</p> : null}
    {cadence ? <p className="summary-note">{tamil ? 'அட்டவணை' : 'Schedule'}: {cadence}</p> : null}
    <p className="summary-note">{pricing}</p>
    {context.requirement_status === 'fulfilled' && recurring ? <p className="summary-note">{tamil ? 'இந்த recurring requirement-ன் அனைத்து service occurrences-மும் நிறைவடைந்துள்ளன. இந்த context read-only final history ஆகும்.' : 'All service occurrences for this recurring requirement are complete. This context is now read-only final history.'}</p> : null}

    {context.recovery ? <div style={{ borderTop: '1px solid #e7eaf0', marginTop: '1rem', paddingTop: '1rem', display: 'grid', gap: '.45rem' }}>
      <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge tone="warning">{tamil ? 'மீட்டெடுக்கப்பட்ட occurrence' : 'Recovered occurrence'}</Badge>
        <strong>{tamil ? `Recovery முயற்சி #${context.recovery.attempt_number}` : `Recovery attempt #${context.recovery.attempt_number}`}</strong>
      </div>
      <p className="summary-note">{tamil ? 'இந்த booking, ரத்து செய்யப்பட்ட முந்தைய booking-ஐ மாற்றி அதே occurrence எண்ணில் உருவாக்கப்பட்டது.' : 'This booking replaces a cancelled booking while keeping the same occurrence number.'}</p>
      <p className="summary-note">
        {tamil ? 'முந்தைய booking' : 'Previous booking'}: <Link href={`/provider/bookings/${encodeURIComponent(context.recovery.prior_booking_id)}`}>{context.recovery.prior_booking_reference}</Link>
      </p>
      <p className="summary-note">{tamil ? 'மீட்டெடுத்த நேரம்' : 'Recovered'}: {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(context.recovery.recovered_at))}</p>
    </div> : null}
  </Card>;
}
