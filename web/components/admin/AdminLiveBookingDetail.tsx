'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminHeading, AdminShell } from './AdminPresentation';
import AdminRefundPanel from './AdminRefundPanel';
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
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ bookingId?: string }>).detail;
      if (!detail?.bookingId || detail.bookingId === bookingId) setRefreshKey((value) => value + 1);
    };
    window.addEventListener('booking:audit-refresh', refresh);
    return () => window.removeEventListener('booking:audit-refresh', refresh);
  }, [bookingId]);

  useEffect(() => {
    let active = true;
    setError('');
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
  }, [bookingId, refreshKey]);

  const booking = payload?.booking;

  return (
    <AdminShell active="/admin/bookings">
      <AdminHeading
        eyebrow="Scoped booking operations"
        title={booking?.booking_reference ?? 'Booking audit'}
        description="Live booking, payment, refund, review, support, and closeout history from Supabase, restricted by the administrator’s assigned marketplace scope."
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
              <p className="admin-fixture-note">Gateway-paid refunds must use the verified refund workflow. Directly marking a Cashfree-paid booking refunded is blocked at the database boundary.</p>
              <dl className="admin-detail-list">
                <div><dt>Booking status</dt><dd>{booking.status.replaceAll('_', ' ')}</dd></div>
                <div><dt>Payment status</dt><dd>{booking.payment_status.replaceAll('_', ' ')}</dd></div>
                <div><dt>Service ID</dt><dd>{booking.service_id}</dd></div>
              </dl>
            </Card>
          </div>

          <AdminRefundPanel
            bookingId={booking.id}
            bookingStatus={booking.status}
            paymentStatus={booking.payment_status}
            amount={booking.quoted_price}
            currency={booking.currency}
          />

          <Card className="admin-detail-card">
            <span className="eyebrow">Unified audit trail</span>
            <h2>Booking + payment + refund chronology</h2>
            <p className="admin-fixture-note">Lifecycle decisions, payment states, and refund states are shown in one chronological read model. Internal gateway references and administrative notes remain outside this shared timeline.</p>
            <BookingAuditList events={payload.events} timezone={booking.timezone} />
          </Card>
        </>
      ) : null}

      {!payload && !error ? null : !booking && !error ? <EmptyState title="Booking unavailable">This booking is outside your assigned admin scope or no longer exists.</EmptyState> : null}
    </AdminShell>
  );
}
