'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
import { ProviderHeading, ProviderShell } from './ProviderPresentation';

type Booking = {
  id: string; booking_reference: string; service_name: string; booking_date: string; start_time: string; timezone: string;
  duration_minutes: number; location: string; customer_notes?: string; quoted_price: number; currency: 'INR' | 'USD';
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled'; payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded'; provider_name: string;
};

function tone(status: Booking['status']) {
  if (status === 'confirmed' || status === 'completed') return 'success' as const;
  if (status === 'cancelled') return 'danger' as const;
  if (status === 'pending') return 'warning' as const;
  return 'info' as const;
}

export default function ProviderBookingDetail({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  const act = async (action: 'accept' | 'decline' | 'complete') => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const payload = await response.json() as { booking?: Booking; error?: string };
      if (!response.ok || !payload.booking) throw new Error(payload.error ?? 'Unable to update booking.');
      setBooking(payload.booking);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update booking.'); }
    finally { setBusy(false); }
  };

  return <ProviderShell active="/provider/bookings">
    <Link href="/provider/bookings">← Back to bookings</Link>
    <ProviderHeading eyebrow={booking?.booking_reference ?? 'Booking'} title={booking?.service_name ?? 'Booking details'} description="Review the customer request and manage the service lifecycle." />
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {!booking ? <Card><p>{error ? 'Booking could not be loaded.' : 'Loading booking…'}</p></Card> : <div className="provider-detail-grid">
      <Card className="provider-detail-card">
        <div className="section-heading"><div><span className="eyebrow">Service details</span><h2>{booking.service_name}</h2></div><Badge tone={tone(booking.status)}>{booking.status}</Badge></div>
        <dl className="provider-profile-details">
          <div><dt>Provider</dt><dd>{booking.provider_name}</dd></div><div><dt>Date and time</dt><dd>{booking.booking_date}, {booking.start_time} {booking.timezone}</dd></div>
          <div><dt>Duration</dt><dd>{booking.duration_minutes} minutes</dd></div><div><dt>Location</dt><dd>{booking.location}</dd></div>
          <div><dt>Price</dt><dd>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: booking.currency }).format(booking.quoted_price)}</dd></div>
          <div><dt>Customer note</dt><dd>{booking.customer_notes || 'No note provided'}</dd></div>
        </dl><Badge tone="neutral">Payment {booking.payment_status}</Badge>
      </Card>
      <Card className="provider-detail-card"><span className="eyebrow">Next action</span><h2>Provider controls</h2>
        {booking.status === 'pending' ? <><p>Accept this request to confirm the booking, or decline it.</p><div className="provider-actions"><Button type="button" disabled={busy} onClick={() => void act('accept')}>Accept booking</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => void act('decline')}>Decline</Button></div></> : null}
        {booking.status === 'confirmed' ? <><p>The booking is confirmed. Mark it completed after the service has been delivered.</p><Button type="button" disabled={busy} onClick={() => void act('complete')}>{busy ? 'Updating…' : 'Mark service completed'}</Button></> : null}
        {booking.status === 'completed' ? <p>This service has been completed. It is ready for the customer review flow.</p> : null}
        {booking.status === 'cancelled' ? <p>This booking is cancelled. No further provider action is available.</p> : null}
        {booking.status === 'rescheduled' ? <p>This booking has been rescheduled. Review the updated schedule before continuing.</p> : null}
      </Card>
    </div>}
  </ProviderShell>;
}
