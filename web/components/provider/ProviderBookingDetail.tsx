'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
import BookingReasonDialog from '../booking/BookingReasonDialog';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
type BookingHistoryEntry = { from_status: BookingStatus | null; to_status: BookingStatus; reason?: string; created_at: string };
type Booking = {
  id: string; booking_reference: string; service_name: string; booking_date: string; start_time: string; timezone: string;
  duration_minutes: number; location: string; customer_notes?: string; quoted_price: number; currency: 'INR' | 'USD';
  status: BookingStatus; payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded'; provider_name: string;
  created_at: string; updated_at: string; history: BookingHistoryEntry[];
};

const declineReasons = ['Schedule conflict', 'Service unavailable', 'Outside service area', 'Unable to fulfil request', 'Other'];
const rescheduleDeclineReasons = ['New time unavailable', 'Schedule conflict', 'Unable to fulfil at requested time', 'Service unavailable', 'Other'];

function tone(status: Booking['status']) {
  if (status === 'confirmed' || status === 'completed') return 'success' as const;
  if (status === 'cancelled') return 'danger' as const;
  if (status === 'pending' || status === 'rescheduled') return 'warning' as const;
  return 'info' as const;
}

function zonedDateTimeToEpoch(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.slice(0, 8).split(':').map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = targetUtc;
  for (let index = 0; index < 3; index += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    guess += targetUtc - representedUtc;
  }
  return guess;
}

function timelineTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timeZone || 'Asia/Kolkata',
  }).format(new Date(value));
}

function lifecycleReason(reason: string, prefix: string) {
  return reason.startsWith(prefix) ? reason.slice(prefix.length).trim() : '';
}

function parseRescheduleAudit(reason: string) {
  if (!reason.startsWith('customer:reschedule |')) return null;
  const parts = reason.split(' | ');
  return {
    reason: parts[1] ?? '',
    from: (parts.find((part) => part.startsWith('from=')) ?? '').replace(/^from=/, ''),
    to: (parts.find((part) => part.startsWith('to=')) ?? '').replace(/^to=/, ''),
  };
}

function timelineCopy(entry: BookingHistoryEntry) {
  const reason = entry.reason || '';
  if (entry.to_status === 'confirmed' && (entry.from_status === 'rescheduled' || reason === 'provider:accept_reschedule')) {
    return { title: 'New time confirmed', detail: 'Provider accepted the customer’s reschedule request.' };
  }
  if (entry.to_status === 'confirmed') return { title: 'Booking confirmed', detail: 'Provider accepted the customer request.' };
  if (entry.to_status === 'completed') return { title: 'Service completed', detail: 'Provider marked the scheduled service as completed.' };
  if (entry.to_status === 'rescheduled') {
    const audit = parseRescheduleAudit(reason);
    if (audit) {
      const movement = audit.from && audit.to ? ` from ${audit.from} to ${audit.to}` : '';
      return { title: 'New time requested', detail: `Customer requested a schedule change${movement}. Reason: ${audit.reason}. Provider confirmation is required.` };
    }
    return { title: 'Booking rescheduled', detail: 'The booking date or time was changed and availability was revalidated.' };
  }
  if (entry.to_status === 'cancelled' && reason.startsWith('provider:decline')) {
    const detail = lifecycleReason(reason, 'provider:decline |');
    if (entry.from_status === 'rescheduled') return { title: 'New time declined', detail: detail ? `Provider declined the reschedule request. Reason: ${detail}` : 'Provider declined the reschedule request.' };
    return { title: 'Booking declined', detail: detail ? `Provider declined the booking. Reason: ${detail}` : 'Provider declined the booking request.' };
  }
  if (entry.to_status === 'cancelled' && reason.startsWith('customer:cancel')) {
    const detail = lifecycleReason(reason, 'customer:cancel |');
    return { title: 'Booking cancelled', detail: detail ? `Customer cancelled the booking. Reason: ${detail}` : 'Customer cancelled the booking.' };
  }
  if (entry.to_status === 'cancelled' && reason.startsWith('provider:')) return { title: 'Booking declined', detail: 'Provider declined the booking request.' };
  if (entry.to_status === 'cancelled') return { title: 'Booking cancelled', detail: reason ? `Reason: ${reason}` : 'The booking was cancelled and its reserved time was released.' };
  return { title: `Status changed to ${entry.to_status}`, detail: entry.from_status ? `Previous status: ${entry.from_status}.` : 'Booking status updated.' };
}

export default function ProviderBookingDetail({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, { cache: 'no-store' });
        const payload = await response.json() as { booking?: Booking; error?: string };
        if (!response.ok || !payload.booking) throw new Error(payload.error ?? 'Unable to load booking.');
        setBooking(payload.booking);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load booking.'); }
    })();
  }, [bookingId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const completion = useMemo(() => {
    if (!booking || booking.status !== 'confirmed') return null;
    const start = zonedDateTimeToEpoch(booking.booking_date, booking.start_time, booking.timezone || 'Asia/Kolkata');
    const eligibleAt = start + booking.duration_minutes * 60_000;
    return {
      eligibleAt,
      allowed: now >= eligibleAt,
      label: new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: booking.timezone || 'Asia/Kolkata' }).format(new Date(eligibleAt)),
    };
  }, [booking, now]);

  const act = async (action: 'accept' | 'decline' | 'complete', reason?: string) => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason }) });
      const payload = await response.json() as { booking?: Booking; error?: string };
      if (!response.ok || !payload.booking) throw new Error(payload.error ?? 'Unable to update booking.');
      setBooking(payload.booking);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update booking.');
      return false;
    } finally { setBusy(false); }
  };

  const rescheduleRequest = booking?.status === 'rescheduled';

  return <LiveProviderShell active="/provider/bookings">
    <Link href="/provider/bookings">← Back to bookings</Link>
    <ProviderHeading eyebrow={booking?.booking_reference ?? 'Booking'} title={booking?.service_name ?? 'Booking details'} description="Review the customer request and manage the service lifecycle." />
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {!booking ? <Card><p>{error ? 'Booking could not be loaded.' : 'Loading booking…'}</p></Card> : <div className="provider-detail-grid">
      <Card className="provider-detail-card">
        <div className="section-heading"><div><span className="eyebrow">Service details</span><h2>{booking.service_name}</h2></div><Badge tone={tone(booking.status)}>{rescheduleRequest ? 'reschedule request' : booking.status}</Badge></div>
        <dl className="provider-profile-details">
          <div><dt>Provider</dt><dd>{booking.provider_name}</dd></div><div><dt>Date and time</dt><dd>{booking.booking_date}, {booking.start_time} {booking.timezone}</dd></div>
          <div><dt>Duration</dt><dd>{booking.duration_minutes} minutes</dd></div><div><dt>Location</dt><dd>{booking.location}</dd></div>
          <div><dt>Price</dt><dd>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: booking.currency }).format(booking.quoted_price)}</dd></div>
          <div><dt>Customer note</dt><dd>{booking.customer_notes || 'No note provided'}</dd></div>
        </dl><Badge tone="neutral">Payment {booking.payment_status}</Badge>
      </Card>
      <Card className="provider-detail-card"><span className="eyebrow">Next action</span><h2>Provider controls</h2>
        {booking.status === 'pending' ? <><p>Accept this request to confirm the booking, or decline it with a reason.</p><div className="provider-actions"><Button type="button" disabled={busy} onClick={() => void act('accept')}>Accept booking</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => setDeclineOpen(true)}>Decline</Button></div></> : null}
        {booking.status === 'rescheduled' ? <><p>The customer requested this new time. Confirm it to return the booking to confirmed status, or decline the new time with a reason.</p><div className="provider-actions"><Button type="button" disabled={busy} onClick={() => void act('accept')}>Accept new time</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => setDeclineOpen(true)}>Decline new time</Button></div></> : null}
        {booking.status === 'confirmed' ? <>{completion?.allowed ? <><p>The scheduled service time has ended. You can now mark the service completed.</p><Button type="button" disabled={busy} onClick={() => void act('complete')}>{busy ? 'Updating…' : 'Mark service completed'}</Button></> : <><p>This service can be marked completed only after the scheduled service time.</p><p className="summary-note">Completion available after {completion?.label}.</p><Button type="button" disabled>Mark service completed</Button></>}</> : null}
        {booking.status === 'completed' ? <p>This service has been completed. It is ready for the customer review flow.</p> : null}
        {booking.status === 'cancelled' ? <p>This booking is cancelled. See the lifecycle timeline for the cancellation or decline reason.</p> : null}
      </Card>
      <div style={{ gridColumn: '1 / -1' }}>
        <Card className="provider-detail-card">
          <span className="eyebrow">Lifecycle</span>
          <h2>Booking timeline</h2>
          <p className="summary-note">A shared operational history of the booking from request through rescheduling, completion, or cancellation.</p>
          <ol aria-label="Booking lifecycle" style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0', display: 'grid', gap: '0.9rem' }}>
            <li style={{ borderLeft: '3px solid var(--border, #d9dce5)', paddingLeft: '1rem' }}>
              <strong>Booking requested</strong>
              <p style={{ margin: '0.25rem 0' }}>Customer created the booking request.</p>
              <small>{timelineTime(booking.created_at, booking.timezone)}</small>
            </li>
            {(booking.history ?? []).map((entry, index) => {
              const copy = timelineCopy(entry);
              return <li key={`${entry.created_at}-${entry.to_status}-${index}`} style={{ borderLeft: '3px solid var(--border, #d9dce5)', paddingLeft: '1rem' }}>
                <strong>{copy.title}</strong>
                <p style={{ margin: '0.25rem 0' }}>{copy.detail}</p>
                <small>{timelineTime(entry.created_at, booking.timezone)}</small>
              </li>;
            })}
          </ol>
        </Card>
      </div>
    </div>}
    <BookingReasonDialog
      open={declineOpen}
      eyebrow={rescheduleRequest ? 'Decline new time' : 'Decline booking'}
      title={rescheduleRequest ? 'Why can’t you accept the new time?' : 'Why can’t you accept this request?'}
      description={rescheduleRequest ? 'Choose why the customer’s requested time cannot be accepted. Declining it cancels the booking because the previous slot has already been released.' : 'Choose the clearest reason. It will be saved in the booking lifecycle for support and audit history.'}
      options={rescheduleRequest ? rescheduleDeclineReasons : declineReasons}
      confirmLabel={rescheduleRequest ? 'Decline new time' : 'Decline booking'}
      busy={busy}
      onClose={() => setDeclineOpen(false)}
      onConfirm={async (reason) => { if (await act('decline', reason)) setDeclineOpen(false); }}
    />
  </LiveProviderShell>;
}
