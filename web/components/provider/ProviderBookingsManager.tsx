'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, Select } from '../ui/primitives';
import BookingReasonDialog from '../booking/BookingReasonDialog';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
type QueueKey = 'action' | 'upcoming' | 'completed' | 'cancelled' | 'all';
type DateScope = 'all' | 'today' | '7d' | '30d';

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
  status: BookingStatus;
  payment_status: PaymentStatus;
  provider_name: string;
  created_at?: string;
  updated_at?: string;
};

const declineReasons = ['Schedule conflict', 'Service unavailable', 'Outside service area', 'Unable to fulfil request', 'Other'];
const rescheduleDeclineReasons = ['New time unavailable', 'Schedule conflict', 'Unable to fulfil at requested time', 'Service unavailable', 'Other'];

function statusTone(status: ProviderBooking['status']) {
  if (status === 'confirmed' || status === 'completed') return 'success' as const;
  if (status === 'cancelled') return 'danger' as const;
  if (status === 'pending' || status === 'rescheduled') return 'warning' as const;
  return 'info' as const;
}

function money(booking: ProviderBooking) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: booking.currency, maximumFractionDigits: 2 }).format(booking.quoted_price);
}

function zonedDateTimeToEpoch(date: string, time: string, timeZone: string) {
  try {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute, second = 0] = time.slice(0, 8).split(':').map(Number);
    const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    let guess = targetUtc;
    for (let index = 0; index < 3; index += 1) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date(guess));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      const representedUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
      guess += targetUtc - representedUtc;
    }
    return guess;
  } catch {
    return new Date(`${date}T${time.slice(0, 8)}Z`).getTime();
  }
}

function bookingStartEpoch(booking: ProviderBooking) {
  return zonedDateTimeToEpoch(booking.booking_date, booking.start_time, booking.timezone || 'Asia/Kolkata');
}

function bookingEndEpoch(booking: ProviderBooking) {
  return bookingStartEpoch(booking) + booking.duration_minutes * 60_000;
}

function needsAction(booking: ProviderBooking, now: number) {
  return booking.status === 'pending'
    || booking.status === 'rescheduled'
    || (booking.status === 'confirmed' && bookingEndEpoch(booking) <= now);
}

function upcoming(booking: ProviderBooking, now: number) {
  return booking.status === 'confirmed' && bookingEndEpoch(booking) > now;
}

function queueMatches(booking: ProviderBooking, queue: QueueKey, now: number) {
  if (queue === 'action') return needsAction(booking, now);
  if (queue === 'upcoming') return upcoming(booking, now);
  if (queue === 'completed') return booking.status === 'completed';
  if (queue === 'cancelled') return booking.status === 'cancelled';
  return true;
}

function todayIso(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function operationalRank(booking: ProviderBooking, now: number) {
  if (booking.status === 'pending' || booking.status === 'rescheduled') return 0;
  if (booking.status === 'confirmed' && bookingEndEpoch(booking) <= now) return 1;
  if (booking.status === 'confirmed') return 2;
  if (booking.status === 'completed') return 3;
  return 4;
}

function queueLabel(booking: ProviderBooking, now: number) {
  if (booking.status === 'pending') return 'new request';
  if (booking.status === 'rescheduled') return 'reschedule request';
  if (booking.status === 'confirmed' && bookingEndEpoch(booking) <= now) return 'completion due';
  return booking.status;
}

function operationalNote(booking: ProviderBooking, now: number) {
  if (booking.status === 'pending') return 'New customer request needs your response.';
  if (booking.status === 'rescheduled') return 'Customer requested this new time. Confirm or decline the updated schedule.';
  if (booking.status === 'confirmed' && bookingEndEpoch(booking) <= now) return 'The scheduled service time has ended. Mark the service completed when the work is done.';
  if (booking.status === 'confirmed') return 'Confirmed upcoming work.';
  if (booking.status === 'completed') return 'Service completed.';
  return 'Booking cancelled.';
}

export default function ProviderBookingsManager() {
  const [items, setItems] = useState<ProviderBooking[]>([]);
  const [queue, setQueue] = useState<QueueKey>('action');
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [dateScope, setDateScope] = useState<DateScope>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<ProviderBooking | null>(null);
  const [now, setNow] = useState(() => Date.now());

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
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const counts = useMemo(() => ({
    action: items.filter((booking) => needsAction(booking, now)).length,
    upcoming: items.filter((booking) => upcoming(booking, now)).length,
    completed: items.filter((booking) => booking.status === 'completed').length,
    cancelled: items.filter((booking) => booking.status === 'cancelled').length,
    all: items.length,
  }), [items, now]);

  const visible = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const timezone = items[0]?.timezone || 'Asia/Kolkata';
    const today = todayIso(timezone);
    const dateLimit = dateScope === '7d' ? addDaysIso(today, 6) : dateScope === '30d' ? addDaysIso(today, 29) : today;

    return items
      .filter((booking) => queueMatches(booking, queue, now))
      .filter((booking) => statusFilter === 'all' || booking.status === statusFilter)
      .filter((booking) => paymentFilter === 'all' || booking.payment_status === paymentFilter)
      .filter((booking) => {
        if (dateScope === 'all') return true;
        if (dateScope === 'today') return booking.booking_date === today;
        return booking.booking_date >= today && booking.booking_date <= dateLimit;
      })
      .filter((booking) => {
        if (!normalizedSearch) return true;
        return [booking.booking_reference, booking.service_name, booking.location, booking.provider_name]
          .some((value) => value?.toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => {
        if (queue === 'completed' || queue === 'cancelled') {
          return String(right.updated_at || right.created_at || '').localeCompare(String(left.updated_at || left.created_at || ''));
        }
        if (queue === 'all') {
          const rank = operationalRank(left, now) - operationalRank(right, now);
          if (rank) return rank;
        }
        return bookingStartEpoch(left) - bookingStartEpoch(right);
      });
  }, [items, queue, statusFilter, paymentFilter, dateScope, search, now]);

  const act = async (bookingId: string, action: 'accept' | 'decline' | 'complete', reason?: string) => {
    setBusyId(bookingId);
    setError('');
    try {
      const response = await fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason }),
      });
      const payload = await response.json() as { booking?: ProviderBooking; error?: string };
      if (!response.ok || !payload.booking) throw new Error(payload.error ?? 'Unable to update booking.');
      setItems((current) => current.map((booking) => booking.id === bookingId ? payload.booking! : booking));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update booking.');
      return false;
    } finally { setBusyId(null); }
  };

  const resetView = () => {
    setQueue('all');
    setStatusFilter('all');
    setPaymentFilter('all');
    setDateScope('all');
    setSearch('');
  };

  const queueOptions: Array<{ key: QueueKey; label: string; count: number }> = [
    { key: 'action', label: 'Needs action', count: counts.action },
    { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { key: 'completed', label: 'Completed', count: counts.completed },
    { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
    { key: 'all', label: 'All', count: counts.all },
  ];

  return <LiveProviderShell active="/provider/bookings">
    <ProviderHeading eyebrow="Operations" title="Bookings" description="Work from a live queue of requests, reschedules, upcoming jobs, completion tasks, and booking history." />

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '.75rem', marginBottom: '1rem' }}>
      {queueOptions.slice(0, 4).map((item) => <Card key={item.key} style={{ padding: '1rem' }}>
        <span className="eyebrow">{item.label}</span>
        <strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.65rem' }}>{item.count}</strong>
      </Card>)}
    </div>

    <div aria-label="Booking queues" style={{ display: 'flex', flexWrap: 'wrap', gap: '.55rem', marginBottom: '1rem' }}>
      {queueOptions.map((item) => <button
        key={item.key}
        type="button"
        className="button button-secondary"
        aria-pressed={queue === item.key}
        onClick={() => setQueue(item.key)}
        style={queue === item.key ? { borderColor: 'var(--color-primary)', background: 'var(--color-selected)', color: 'var(--color-primary-strong)' } : undefined}
      >{item.label} <span aria-hidden="true">({item.count})</span></button>)}
    </div>

    <Card style={{ padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.8rem', alignItems: 'end' }}>
        <label className="field">
          <span className="field-label">Search bookings</span>
          <input className="field-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, service or location" />
        </label>
        <Select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | BookingStatus)}>
          <option value="all">Any status</option><option value="pending">Pending</option><option value="rescheduled">Reschedule request</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </Select>
        <Select label="Date" value={dateScope} onChange={(event) => setDateScope(event.target.value as DateScope)}>
          <option value="all">All dates</option><option value="today">Today</option><option value="7d">Next 7 days</option><option value="30d">Next 30 days</option>
        </Select>
        <Select label="Payment" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as 'all' | PaymentStatus)}>
          <option value="all">Any payment status</option><option value="unpaid">Unpaid</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="refunded">Refunded</option>
        </Select>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '.75rem', alignItems: 'center', marginTop: '.9rem' }}>
        <span className="provider-fixture-note">{visible.length} of {items.length} booking{items.length === 1 ? '' : 's'} shown</span>
        <Button type="button" variant="quiet" onClick={resetView}>Reset view</Button>
      </div>
    </Card>

    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>Try again</Button></Card> : null}
    {loading ? <Card><p>Loading provider bookings…</p></Card> : visible.length ? <div className="provider-booking-list">
      {visible.map((booking) => {
        const actionableRequest = booking.status === 'pending' || booking.status === 'rescheduled';
        const rescheduleRequest = booking.status === 'rescheduled';
        const completionDue = booking.status === 'confirmed' && bookingEndEpoch(booking) <= now;
        return <Card className="provider-booking-card" key={booking.id}>
          <div className="provider-booking-top"><div><span className="eyebrow">{booking.booking_reference}</span><h2>{booking.service_name}</h2></div><Badge tone={completionDue ? 'warning' : statusTone(booking.status)}>{queueLabel(booking, now)}</Badge></div>
          <p className="provider-service-name">Customer booking · {booking.provider_name}</p>
          <dl className="provider-booking-details"><div><dt>When</dt><dd>{booking.booking_date}, {booking.start_time} {booking.timezone}</dd></div><div><dt>Duration</dt><dd>{booking.duration_minutes} minutes</dd></div><div><dt>Location</dt><dd>{booking.location}</dd></div><div><dt>Value</dt><dd>{money(booking)}</dd></div></dl>
          <p className="provider-customer-note">{operationalNote(booking, now)}</p>
          {booking.customer_notes ? <p className="provider-customer-note">Customer note: {booking.customer_notes}</p> : null}
          <div className="provider-booking-footer"><Badge tone="neutral">Payment {booking.payment_status}</Badge><div className="provider-actions">
            <Link className="button button-secondary" href={`/provider/bookings/${encodeURIComponent(booking.id)}`}>View details</Link>
            {actionableRequest ? <><Button type="button" variant="secondary" disabled={busyId === booking.id} onClick={() => void act(booking.id, 'accept')}>{busyId === booking.id ? 'Updating…' : rescheduleRequest ? 'Accept new time' : 'Accept'}</Button><Button type="button" variant="quiet" disabled={busyId === booking.id} onClick={() => setDeclineTarget(booking)}>{rescheduleRequest ? 'Decline new time' : 'Decline'}</Button></> : null}
            {completionDue ? <Button type="button" disabled={busyId === booking.id} onClick={() => void act(booking.id, 'complete')}>{busyId === booking.id ? 'Updating…' : 'Mark completed'}</Button> : null}
          </div></div>
        </Card>;
      })}
    </div> : <Card><EmptyState title={queue === 'action' ? 'Nothing needs action' : 'No bookings match this view'}>{queue === 'action' ? 'New requests, reschedule requests, and services ready for completion will appear here.' : 'Try another queue or reset the filters.'}</EmptyState></Card>}
    <BookingReasonDialog
      open={Boolean(declineTarget)}
      eyebrow={declineTarget?.status === 'rescheduled' ? 'Decline new time' : 'Decline booking'}
      title={declineTarget ? (declineTarget.status === 'rescheduled' ? `Decline the new time for ${declineTarget.service_name}?` : `Decline ${declineTarget.service_name}?`) : 'Decline booking?'}
      description={declineTarget?.status === 'rescheduled' ? 'Choose why the new time cannot be accepted. Declining this reschedule cancels the booking because the previous slot has already been released.' : 'Choose the clearest reason. It will be saved in the booking lifecycle for support and audit history.'}
      options={declineTarget?.status === 'rescheduled' ? rescheduleDeclineReasons : declineReasons}
      confirmLabel={declineTarget?.status === 'rescheduled' ? 'Decline new time' : 'Decline booking'}
      busy={Boolean(declineTarget && busyId === declineTarget.id)}
      onClose={() => setDeclineTarget(null)}
      onConfirm={async (reason) => {
        if (!declineTarget) return;
        if (await act(declineTarget.id, 'decline', reason)) setDeclineTarget(null);
      }}
    />
  </LiveProviderShell>;
}
