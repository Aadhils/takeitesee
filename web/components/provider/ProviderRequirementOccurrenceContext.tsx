'use client';

import { useEffect, useState } from 'react';
import { Badge, Card } from '../ui/primitives';

type RequirementContext = {
  requirement_id: string;
  requirement_title: string;
  schedule_pattern: 'one_time' | 'recurring';
  occurrence_number: number;
  occurrence_count: number;
  recurrence_frequency: 'daily' | 'weekly' | 'monthly' | null;
  recurrence_interval: number | null;
  recurrence_weekdays: number[] | null;
  pricing_basis: 'per_occurrence' | 'whole_requirement' | null;
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

  return <Card className="provider-detail-card">
    <div className="section-heading">
      <div><span className="eyebrow">{tamil ? 'Requirement வேலை' : 'Requirement job'}</span><h2>{context.requirement_title}</h2></div>
      <Badge tone={recurring ? 'info' : 'neutral'}>{recurring ? (tamil ? 'Recurring' : 'Recurring') : (tamil ? 'ஒருமுறை' : 'One time')}</Badge>
    </div>
    {recurring ? <p><strong>{tamil ? 'Occurrence' : 'Occurrence'} #{context.occurrence_number}</strong> / {context.occurrence_count}</p> : null}
    {cadence ? <p className="summary-note">{tamil ? 'அட்டவணை' : 'Schedule'}: {cadence}</p> : null}
    <p className="summary-note">{pricing}</p>
  </Card>;
}
