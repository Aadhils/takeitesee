'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminHeading, AdminShell } from './AdminPresentation';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { BookingAuditList, type BookingAuditPayload } from '../booking/BookingAuditTimeline';

function bookingTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'confirmed' || status === 'completed') return 'success';
  if (status === 'cancelled') return 'danger';
  if (status === 'pending' || status === 'rescheduled') return 'warning';
  return 'info';
}

function paymentTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'paid') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'pending' || status === 'unpaid') return 'warning';
  if (status === 'refunded') return 'info';
  return 'neutral';
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function AdminLiveBookingDetail({ bookingId }: { bookingId: string }) {
  const [payload, setPayload] = useState<BookingAuditPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/audit`, { cache: 'no-store' });
        const body = await response.json() as BookingAuditPayload & { error?: string };
        if (!response.ok || !body.booking || !Array.isArray(body.events)) throw new Error(body.error ?? 'Unable to load booking audit.');
        if (active) setPayload(body);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load booking audit.');
      }
    })();
    return () => { active = false; };
  }, [bookingId]);

  const booking = payload?.booking;

  return (
    <AdminShell active="/admin/bookings">
      <AdminHeading
        eyebrow="Scoped booking operations"
        title={booking?.booking_reference ?? 'Booking audit'}
        description="Live booking and payment history from Supabase, restricted by the administrator’s assigned marketplace scope."
        action={<Link href="/admin/bookings" className="button button-secondary">Back to bookings</Link>}
      />

      {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
      {!payload && !error ? <Card><p>Loading live booking audit…</p></Card> : null}

      {booking ? (
        <>
          <div className="admin-detail-grid">
            <Card className="admin-detail-card">
              <div className="admin-record-top">
                <div><span className="eyebrow">Booking record</span><h2>{booking.service_name}</h2></div>
                <Badge tone={bookingTone(booking.status)}>{booking.status.replaceAll('_', ' ')}</Badge>
              </div>
              <dl className="admin-detail-list">
                <div><dt>Provider</dt><dd>{booking.provider_name}</dd></div>
                <div><dt>Customer account</dt><dd>{booking.customer_id.slice(0, 8)}…</dd></div>
                <div><dt>Date/time</dt><dd>{booking.booking_date}, {booking.start_time} {booking.timezone}</dd></div>
                <div><dt>Duration</dt><dd>{booking.duration_minutes} minutes</dd></div>
                <div><dt>Location</dt><dd>{booking.location || 'Not specified'}</dd></div>
                <div><dt>Price</dt><dd>{money(booking.quoted_price, booking.currency)}</dd></div>
              </dl>
            </Card>

            <Card className="admin-detail-card">
              <span className="eyebrow">Current financial state</span>
              <h2>Payment coordination</h2>
              <Badge tone={paymentTone(booking.payment_status)}>Payment {booking.payment_status}</Badge>
              <p className="admin-fixture-note">This page is a read-only operational audit. Payment changes remain restricted to the high-trust platform payment management path.</p>
              <dl className="admin-detail-list">
                <div><dt>Booking status</dt><dd>{booking.status.replaceAll('_', ' ')}</dd></div>
                <div><dt>Payment status</dt><dd>{booking.payment_status.replaceAll('_', ' ')}</dd></div>
                <div><dt>Service ID</dt><dd>{booking.service_id}</dd></div>
              </dl>
            </Card>
          </div>

          <Card className="admin-detail-card">
            <span className="eyebrow">Unified audit trail</span>
            <h2>Booking + payment chronology</h2>
            <p className="admin-fixture-note">Lifecycle decisions and payment-state events are shown in one chronological read model. Internal gateway references and administrative payment notes are intentionally not exposed in this shared timeline.</p>
            <BookingAuditList events={payload.events} timezone={booking.timezone} />
          </Card>
        </>
      ) : null}

      {!payload && !error ? null : !booking && !error ? <EmptyState title="Booking unavailable">This booking is outside your assigned admin scope or no longer exists.</EmptyState> : null}
    </AdminShell>
  );
}
