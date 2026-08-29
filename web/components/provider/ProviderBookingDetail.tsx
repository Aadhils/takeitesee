'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
import BookingAuditTimeline from '../booking/BookingAuditTimeline';
import BookingCloseoutPanel from '../booking/BookingCloseoutPanel';
import BookingReasonDialog from '../booking/BookingReasonDialog';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
type Booking = {
  id: string; booking_reference: string; service_name: string; booking_date: string; start_time: string; timezone: string;
  duration_minutes: number; location: string; customer_notes?: string; quoted_price: number; currency: 'INR' | 'USD';
  status: BookingStatus; payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded'; provider_name: string;
  created_at: string; updated_at: string;
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

  const refreshLifecycle = () => {
    window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
    window.dispatchEvent(new CustomEvent('booking:closeout-refresh', { detail: { bookingId } }));
  };

  const act = async (action: 'accept' | 'decline' | 'complete', reason?: string) => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason }) });
      const payload = await response.json() as { booking?: Booking; error?: string };
      if (!response.ok || !payload.booking) throw new Error(payload.error ?? 'Unable to update booking.');
      setBooking(payload.booking);
      refreshLifecycle();
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
        {booking.status === 'completed' ? <p>This service has been completed. Review and support closeout now stay linked to the booking.</p> : null}
        {booking.status === 'cancelled' ? <p>This booking is cancelled. Any support follow-up remains visible in the closeout and audit views.</p> : null}
      </Card>
      <div style={{ gridColumn: '1 / -1' }}><BookingCloseoutPanel bookingId={booking.id} /></div>
      <div style={{ gridColumn: '1 / -1' }}>
        <BookingAuditTimeline bookingId={booking.id} refreshKey={booking.updated_at} title="Operational lifecycle timeline" description="Booking, payment, review, and support events are merged into one chronological audit trail." />
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
