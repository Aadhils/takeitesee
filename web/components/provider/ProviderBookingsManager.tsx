'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, Select } from '../ui/primitives';
import { ProviderHeading, ProviderShell } from './ProviderPresentation';

type ProviderBooking = {
  id: string;
  booking_reference: string;
  customer_id: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  timezone: string;
  duration_minutes: number;
  location: string;
  customer_notes?: string;
  quoted_price: number;
  currency: 'INR' | 'USD';
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
  provider_name: string;
};

function statusTone(status: ProviderBooking['status']) {
  if (status === 'confirmed' || status === 'completed') return 'success' as const;
  if (status === 'cancelled') return 'danger' as const;
  if (status === 'pending') return 'warning' as const;
  return 'info' as const;
}

function money(booking: ProviderBooking) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: booking.currency, maximumFractionDigits: 2 }).format(booking.quoted_price);
}

export default function ProviderBookingsManager() {
  const [items, setItems] = useState<ProviderBooking[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/bookings', { cache: 'no-store' });
      const payload = await response.json() as { bookings?: ProviderBooking[]; error?: string };
      if (!response.ok || !payload.bookings) throw new Error(payload.error ?? 'Unable to load bookings.');
      setItems(payload.bookings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => items.filter((booking) => filter === 'all' || booking.status === filter), [items, filter]);
  const pendingCount = items.filter((booking) => booking.status === 'pending').length;

  const act = async (bookingId: string, action: 'accept' | 'decline') => {
    setBusyId(bookingId);
    setError('');
    try {
      const response = await fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json() as { booking?: ProviderBooking; error?: string };
      if (!response.ok || !payload.booking) throw new Error(payload.error ?? 'Unable to update booking.');
      setItems((current) => current.map((booking) => booking.id === bookingId ? payload.booking! : booking));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update booking.');
    } finally {
      setBusyId(null);
    }
  };

  return <ProviderShell active="/provider/bookings">
    <ProviderHeading eyebrow="Operations" title="Bookings" description="Review real incoming customer bookings and respond from the provider workspace." />
    <div className="provider-toolbar">
      <Select label="Filter bookings" value={filter} onChange={(event) => setFilter(event.target.value)}>
        <option value="all">All statuses</option>
        <option value="pending">Pending requests</option>
        <option value="confirmed">Confirmed</option>
        <option value="rescheduled">Rescheduled</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </Select>
      <span className="provider-fixture-note">{pendingCount} pending request{pendingCount === 1 ? '' : 's'}</span>
    </div>
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>Try again</Button></Card> : null}
    {loading ? <Card><p>Loading provider bookings…</p></Card> : visible.length ? <div className="provider-booking-list">
      {visible.map((booking) => <Card className="provider-booking-card" key={booking.id}>
        <div className="provider-booking-top"><div><span className="eyebrow">{booking.booking_reference}</span><h2>{booking.service_name}</h2></div><Badge tone={statusTone(booking.status)}>{booking.status}</Badge></div>
        <p className="provider-service-name">Customer booking · {booking.provider_name}</p>
        <dl className="provider-booking-details">
          <div><dt>When</dt><dd>{booking.booking_date}, {booking.start_time} {booking.timezone}</dd></div>
          <div><dt>Duration</dt><dd>{booking.duration_minutes} minutes</dd></div>
          <div><dt>Location</dt><dd>{booking.location}</dd></div>
          <div><dt>Value</dt><dd>{money(booking)}</dd></div>
        </dl>
        {booking.customer_notes ? <p className="provider-customer-note">Customer note: {booking.customer_notes}</p> : null}
        <div className="provider-booking-footer"><Badge tone="neutral">Payment {booking.payment_status}</Badge><div className="provider-actions">
          {booking.status === 'pending' ? <><Button type="button" variant="secondary" disabled={busyId === booking.id} onClick={() => void act(booking.id, 'accept')}>{busyId === booking.id ? 'Updating…' : 'Accept'}</Button><Button type="button" variant="quiet" disabled={busyId === booking.id} onClick={() => void act(booking.id, 'decline')}>Decline</Button></> : null}
        </div></div>
      </Card>)}
    </div> : <Card><EmptyState title="No bookings in this state">New provider booking activity will appear here.</EmptyState></Card>}
  </ProviderShell>;
}
