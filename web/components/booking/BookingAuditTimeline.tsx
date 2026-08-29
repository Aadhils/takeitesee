'use client';

import { useEffect, useState } from 'react';
import { Badge, Card } from '../ui/primitives';

export type BookingAuditEvent = {
  id: string;
  category: 'booking' | 'payment' | 'refund' | 'review' | 'support' | 'closeout';
  actor: 'customer' | 'provider' | 'admin' | 'gateway' | 'system' | 'migration';
  status: string;
  title: string;
  detail: string;
  occurred_at: string;
};

export type BookingAuditSummary = {
  id: string; booking_reference: string; customer_id: string; service_id: string; service_name: string; provider_type: 'professional' | 'business'; provider_name: string;
  booking_date: string; start_time: string; timezone: string; duration_minutes: number; location: string; quoted_price: number; currency: string; status: string; payment_status: string; created_at: string; updated_at: string;
};
export type BookingAuditPayload = { booking: BookingAuditSummary; events: BookingAuditEvent[] };

function eventTone(event: BookingAuditEvent): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (event.category === 'payment') {
    if (event.status === 'paid') return 'success';
    if (event.status === 'failed') return 'danger';
    if (event.status === 'refunded') return 'info';
    if (event.status === 'pending' || event.status === 'unpaid') return 'warning';
    return 'neutral';
  }
  if (event.category === 'refund') {
    if (event.status === 'succeeded') return 'success';
    if (event.status === 'failed' || event.status === 'cancelled') return 'danger';
    if (event.status === 'created' || event.status === 'pending' || event.status === 'onhold' || event.status === 'requires_review') return 'warning';
    return 'info';
  }
  if (event.category === 'review') return event.status === 'published' || event.status === 'responded' ? 'success' : 'info';
  if (event.category === 'support') {
    if (event.status === 'resolved' || event.status === 'closed') return 'success';
    if (event.status === 'open' || event.status === 'investigating' || event.status === 'awaiting_information') return 'warning';
    return 'info';
  }
  if (event.category === 'closeout') {
    if (event.status === 'closed' || event.status === 'customer_completion_confirmed') return 'success';
    if (event.status === 'provider_no_show_reported') return 'danger';
    if (event.status === 'customer_no_show_reported' || event.status === 'eligible_to_close') return 'warning';
    return 'info';
  }
  if (event.status === 'confirmed' || event.status === 'completed') return 'success';
  if (event.status === 'cancelled') return 'danger';
  if (event.status === 'pending' || event.status === 'rescheduled') return 'warning';
  return 'info';
}

function formatMoment(value: string, timeZone: string) {
  try { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: timeZone || 'Asia/Kolkata' }).format(new Date(value)); }
  catch { return new Date(value).toLocaleString('en-IN'); }
}

export function BookingAuditList({ events, timezone }: { events: BookingAuditEvent[]; timezone: string }) {
  return <ol aria-label="Booking lifecycle audit timeline" style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0', display: 'grid', gap: '0.9rem' }}>
    {events.map((event) => <li key={event.id} style={{ borderLeft: '3px solid var(--border, #d9dce5)', paddingLeft: '1rem' }}>
      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}><strong>{event.title}</strong><Badge tone={eventTone(event)}>{event.category}</Badge><Badge tone="neutral">{event.actor}</Badge></div>
      <p style={{ margin: '0.3rem 0' }}>{event.detail}</p><small>{formatMoment(event.occurred_at, timezone)}</small>
    </li>)}
  </ol>;
}

export default function BookingAuditTimeline({ bookingId, refreshKey, title = 'Lifecycle timeline', description = 'A chronological audit trail combining booking, payment, refund, attendance, review, support, and final closeout events.' }: { bookingId: string; refreshKey?: string | number; title?: string; description?: string }) {
  const [payload, setPayload] = useState<BookingAuditPayload | null>(null);
  const [error, setError] = useState('');
  const [eventRefresh, setEventRefresh] = useState(0);

  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ bookingId?: string }>).detail;
      if (!detail?.bookingId || detail.bookingId === bookingId) setEventRefresh((value) => value + 1);
    };
    window.addEventListener('booking:audit-refresh', refresh);
    return () => window.removeEventListener('booking:audit-refresh', refresh);
  }, [bookingId]);

  useEffect(() => {
    let active = true; setError('');
    void (async () => {
      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/audit`, { cache: 'no-store' });
        const body = await response.json() as BookingAuditPayload & { error?: string };
        if (!response.ok || !body.booking || !Array.isArray(body.events)) throw new Error(body.error ?? 'Unable to load booking timeline.');
        if (active) setPayload(body);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load booking timeline.'); }
    })();
    return () => { active = false; };
  }, [bookingId, refreshKey, eventRefresh]);

  return <Card className="policy-card"><span className="eyebrow">Audit trail</span><h2>{title}</h2><p className="summary-note">{description}</p>{error ? <p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p> : null}{!payload && !error ? <p>Loading timeline…</p> : null}{payload ? <BookingAuditList events={payload.events} timezone={payload.booking.timezone} /> : null}</Card>;
}
