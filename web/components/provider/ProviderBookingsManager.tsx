'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, Select } from '../ui/primitives';
import BookingReasonDialog from '../booking/BookingReasonDialog';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import { useOperationalTranslations, type OperationalKey } from '../i18n/OperationalTranslations';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
type AttendanceOutcome = 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';
type QueueKey = 'action' | 'upcoming' | 'completed' | 'outcomes' | 'cancelled' | 'all';
type DateScope = 'all' | 'today' | '7d' | '30d';

type ProviderBooking = {
  id: string; booking_reference: string; customer_id: string; service_name: string; booking_date: string; start_time: string; timezone: string;
  duration_minutes: number; location: string; customer_notes?: string; quoted_price: number; currency: 'INR' | 'USD'; status: BookingStatus;
  payment_status: PaymentStatus; provider_name: string; created_at?: string; updated_at?: string;
  attendance_outcome: AttendanceOutcome; closeout_state?: 'open' | 'awaiting_customer' | 'support_open' | 'eligible_to_close' | 'closed'; closed_at?: string;
};

const declineReasonKeys: OperationalKey[] = [
  'provider.reason.scheduleConflict',
  'provider.reason.serviceUnavailable',
  'provider.reason.outsideServiceArea',
  'provider.reason.unableFulfil',
  'provider.reason.other',
];
const rescheduleDeclineReasonKeys: OperationalKey[] = [
  'provider.reason.newTimeUnavailable',
  'provider.reason.scheduleConflict',
  'provider.reason.unableRequestedTime',
  'provider.reason.serviceUnavailable',
  'provider.reason.other',
];

function zonedDateTimeToEpoch(date: string, time: string, timeZone: string) {
  try {
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
  } catch { return new Date(`${date}T${time.slice(0, 8)}Z`).getTime(); }
}

function bookingStartEpoch(booking: ProviderBooking) { return zonedDateTimeToEpoch(booking.booking_date, booking.start_time, booking.timezone || 'Asia/Kolkata'); }
function bookingEndEpoch(booking: ProviderBooking) { return bookingStartEpoch(booking) + booking.duration_minutes * 60_000; }
function attendanceTerminal(booking: ProviderBooking) { return booking.attendance_outcome === 'customer_no_show' || booking.attendance_outcome === 'provider_no_show'; }
function closeoutOutcome(booking: ProviderBooking) { return attendanceTerminal(booking) || booking.closeout_state === 'eligible_to_close' || booking.closeout_state === 'closed'; }

function needsAction(booking: ProviderBooking, now: number) {
  if (closeoutOutcome(booking)) return false;
  return booking.status === 'pending' || booking.status === 'rescheduled' || (booking.status === 'confirmed' && booking.attendance_outcome === 'pending' && bookingEndEpoch(booking) <= now);
}
function upcoming(booking: ProviderBooking, now: number) { return !closeoutOutcome(booking) && booking.status === 'confirmed' && booking.attendance_outcome === 'pending' && bookingEndEpoch(booking) > now; }
function queueMatches(booking: ProviderBooking, queue: QueueKey, now: number) {
  if (queue === 'action') return needsAction(booking, now);
  if (queue === 'upcoming') return upcoming(booking, now);
  if (queue === 'completed') return booking.status === 'completed' && !closeoutOutcome(booking);
  if (queue === 'outcomes') return closeoutOutcome(booking);
  if (queue === 'cancelled') return booking.status === 'cancelled' && !closeoutOutcome(booking);
  return true;
}
function statusTone(booking: ProviderBooking, now: number) {
  if (booking.attendance_outcome === 'provider_no_show') return 'danger' as const;
  if (booking.attendance_outcome === 'customer_no_show' || booking.closeout_state === 'eligible_to_close' || booking.closeout_state === 'support_open' || needsAction(booking, now)) return 'warning' as const;
  if (booking.closeout_state === 'closed') return 'success' as const;
  if (booking.status === 'completed' && booking.closeout_state === 'awaiting_customer') return 'warning' as const;
  if (booking.status === 'completed') return 'info' as const;
  if (booking.status === 'confirmed') return 'success' as const;
  if (booking.status === 'cancelled') return 'danger' as const;
  return 'info' as const;
}
function todayIso(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch { return new Date().toISOString().slice(0, 10); }
}
function addDaysIso(value: string, days: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function operationalRank(booking: ProviderBooking, now: number) {
  if (booking.status === 'pending' || booking.status === 'rescheduled') return 0;
  if (booking.status === 'confirmed' && booking.attendance_outcome === 'pending' && bookingEndEpoch(booking) <= now) return 1;
  if (booking.status === 'confirmed' && booking.attendance_outcome === 'pending') return 2;
  if (closeoutOutcome(booking)) return 4;
  if (booking.status === 'completed') return 3;
  return 5;
}

export default function ProviderBookingsManager() {
  const { locale, t, status } = useOperationalTranslations();
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

  const money = (booking: ProviderBooking) => new Intl.NumberFormat(locale, { style: 'currency', currency: booking.currency, maximumFractionDigits: 2 }).format(booking.quoted_price);
  const queueLabel = (booking: ProviderBooking) => {
    if (booking.closeout_state === 'closed') return t('provider.queue.finalHistory');
    if (booking.closeout_state === 'eligible_to_close') return t('provider.queue.finalCloseoutPending');
    if (booking.attendance_outcome === 'customer_no_show') return status('customer_no_show');
    if (booking.attendance_outcome === 'provider_no_show') return status('provider_no_show');
    if (booking.closeout_state === 'support_open') return t('provider.queue.supportInProgress');
    if (booking.status === 'completed' && booking.closeout_state === 'awaiting_customer') return t('provider.queue.awaitingCustomer');
    if (booking.status === 'completed' && booking.closeout_state === 'open') return t('provider.queue.customerAcknowledged');
    if (booking.status === 'completed') return t('provider.queue.serviceCompleted');
    if (booking.status === 'pending') return t('provider.queue.newRequest');
    if (booking.status === 'rescheduled') return t('provider.rescheduleRequest');
    if (booking.status === 'confirmed' && bookingEndEpoch(booking) <= now) return t('provider.queue.completionDue');
    return status(booking.status);
  };
  const operationalNote = (booking: ProviderBooking) => {
    if (booking.closeout_state === 'closed') return t('provider.note.closed');
    if (booking.closeout_state === 'eligible_to_close') return t('provider.note.eligibleToClose');
    if (booking.attendance_outcome === 'customer_no_show') return t('provider.note.customerNoShow');
    if (booking.attendance_outcome === 'provider_no_show') return t('provider.note.providerNoShow');
    if (booking.closeout_state === 'support_open') return t('provider.note.supportOpen');
    if (booking.status === 'completed' && booking.closeout_state === 'awaiting_customer') return t('provider.note.awaitingCustomer');
    if (booking.status === 'completed' && booking.closeout_state === 'open') return t('provider.note.customerAcknowledged');
    if (booking.status === 'pending') return t('provider.note.newRequest');
    if (booking.status === 'rescheduled') return t('provider.note.rescheduled');
    if (booking.status === 'confirmed' && bookingEndEpoch(booking) <= now) return t('provider.note.completionDue');
    if (booking.status === 'confirmed') return t('provider.note.confirmed');
    if (booking.status === 'completed') return t('provider.note.completed');
    return t('provider.note.cancelled');
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/provider/bookings', { cache: 'no-store' });
      const payload = await response.json() as { bookings?: ProviderBooking[]; error?: string };
      if (!response.ok || !payload.bookings) throw new Error(payload.error ?? t('provider.loadFallback'));
      setItems(payload.bookings);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('provider.loadFallback')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener('booking:provider-list-refresh', refresh);
    return () => window.removeEventListener('booking:provider-list-refresh', refresh);
  }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);

  const counts = useMemo(() => ({
    action: items.filter((booking) => needsAction(booking, now)).length,
    upcoming: items.filter((booking) => upcoming(booking, now)).length,
    completed: items.filter((booking) => queueMatches(booking, 'completed', now)).length,
    outcomes: items.filter(closeoutOutcome).length,
    cancelled: items.filter((booking) => booking.status === 'cancelled' && !closeoutOutcome(booking)).length,
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
      .filter((booking) => dateScope === 'all' || (dateScope === 'today' ? booking.booking_date === today : booking.booking_date >= today && booking.booking_date <= dateLimit))
      .filter((booking) => !normalizedSearch || [booking.booking_reference, booking.service_name, booking.location, booking.provider_name].some((value) => value?.toLowerCase().includes(normalizedSearch)))
      .sort((left, right) => {
        if (['completed', 'outcomes', 'cancelled'].includes(queue)) return String(right.updated_at || right.created_at || '').localeCompare(String(left.updated_at || left.created_at || ''));
        if (queue === 'all') { const rank = operationalRank(left, now) - operationalRank(right, now); if (rank) return rank; }
        return bookingStartEpoch(left) - bookingStartEpoch(right);
      });
  }, [items, queue, statusFilter, paymentFilter, dateScope, search, now]);

  const act = async (bookingId: string, action: 'accept' | 'decline' | 'complete', reason?: string) => {
    setBusyId(bookingId); setError('');
    try {
      const response = await fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason }) });
      const payload = await response.json() as { booking?: ProviderBooking; error?: string };
      if (!response.ok || !payload.booking) throw new Error(payload.error ?? t('provider.updateFallback'));
      setItems((current) => current.map((booking) => booking.id === bookingId ? payload.booking! : booking));
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('provider.updateFallback')); return false; }
    finally { setBusyId(null); }
  };

  const resetView = () => { setQueue('all'); setStatusFilter('all'); setPaymentFilter('all'); setDateScope('all'); setSearch(''); };
  const queueOptions: Array<{ key: QueueKey; labelKey: OperationalKey; count: number }> = [
    { key: 'action', labelKey: 'provider.needsAction', count: counts.action },
    { key: 'upcoming', labelKey: 'provider.upcoming', count: counts.upcoming },
    { key: 'completed', labelKey: 'provider.completed', count: counts.completed },
    { key: 'outcomes', labelKey: 'provider.closeout', count: counts.outcomes },
    { key: 'cancelled', labelKey: 'provider.cancelled', count: counts.cancelled },
    { key: 'all', labelKey: 'common.all', count: counts.all },
  ];

  return <LiveProviderShell active="/provider/bookings">
    <ProviderHeading eyebrow={t('provider.operations')} title={t('provider.bookings')} description={t('provider.bookingsIntro')} />

    <Card style={{ padding: '1rem', marginBottom: '1rem' }}>
      <strong>{t('provider.historyExplainerTitle')}</strong>
      <p className="summary-note" style={{ margin: '.35rem 0 0' }}>{t('provider.historyExplainerHelp')}</p>
    </Card>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '.75rem', marginBottom: '1rem' }}>
      {queueOptions.slice(0, 4).map((item) => <Card key={item.key} style={{ padding: '1rem' }}><span className="eyebrow">{t(item.labelKey)}</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.65rem' }}>{item.count}</strong></Card>)}
    </div>

    <div aria-label={t('provider.bookings')} style={{ display: 'flex', flexWrap: 'wrap', gap: '.55rem', marginBottom: '1rem' }}>
      {queueOptions.map((item) => <button key={item.key} type="button" className="button button-secondary" aria-pressed={queue === item.key} onClick={() => setQueue(item.key)} style={queue === item.key ? { borderColor: 'var(--color-primary)', background: 'var(--color-selected)', color: 'var(--color-primary-strong)' } : undefined}>{t(item.labelKey)} <span aria-hidden="true">({item.count})</span></button>)}
    </div>

    <Card style={{ padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.8rem', alignItems: 'end' }}>
        <label className="field"><span className="field-label">{t('provider.searchBookings')}</span><input className="field-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('provider.searchPlaceholder')} /></label>
        <Select label={t('common.status')} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | BookingStatus)}><option value="all">{t('provider.anyStatus')}</option><option value="pending">{t('provider.pending')}</option><option value="rescheduled">{t('provider.rescheduleRequest')}</option><option value="confirmed">{t('provider.confirmed')}</option><option value="completed">{t('provider.completed')}</option><option value="cancelled">{t('provider.cancelled')}</option></Select>
        <Select label={t('common.date')} value={dateScope} onChange={(event) => setDateScope(event.target.value as DateScope)}><option value="all">{t('provider.allDates')}</option><option value="today">{t('common.today')}</option><option value="7d">{t('provider.next7')}</option><option value="30d">{t('provider.next30')}</option></Select>
        <Select label={t('common.payment')} value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as 'all' | PaymentStatus)}><option value="all">{t('provider.anyPayment')}</option><option value="unpaid">{status('unpaid')}</option><option value="pending">{status('pending')}</option><option value="paid">{status('paid')}</option><option value="failed">{status('failed')}</option><option value="refunded">{status('refunded')}</option></Select>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '.75rem', alignItems: 'center', marginTop: '.9rem' }}><span className="provider-fixture-note">{visible.length} / {items.length} {t(items.length === 1 ? 'provider.bookingSingular' : 'provider.bookingPlural')} {t('provider.shown')}</span><Button type="button" variant="quiet" onClick={resetView}>{t('provider.reset')}</Button></div>
    </Card>

    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>{t('common.tryAgain')}</Button></Card> : null}
    {loading ? <Card><p>{t('provider.loadingBookings')}</p></Card> : visible.length ? <div className="provider-booking-list">
      {visible.map((booking) => {
        const actionableRequest = booking.status === 'pending' || booking.status === 'rescheduled';
        const rescheduleRequest = booking.status === 'rescheduled';
        const completionDue = booking.status === 'confirmed' && booking.attendance_outcome === 'pending' && bookingEndEpoch(booking) <= now;
        return <Card className="provider-booking-card" key={booking.id}>
          <div className="provider-booking-top"><div><span className="eyebrow">{booking.booking_reference}</span><h2>{booking.service_name}</h2></div><Badge tone={statusTone(booking, now)}>{queueLabel(booking)}</Badge></div>
          <p className="provider-service-name">{t('provider.customerBooking')} · {booking.provider_name}</p>
          <dl className="provider-booking-details"><div><dt>{t('common.when')}</dt><dd>{booking.booking_date}, {booking.start_time} {booking.timezone}</dd></div><div><dt>{t('common.duration')}</dt><dd>{booking.duration_minutes} {t('common.minutes')}</dd></div><div><dt>{t('common.location')}</dt><dd>{booking.location}</dd></div><div><dt>{t('common.value')}</dt><dd>{money(booking)}</dd></div></dl>
          <p className="provider-customer-note">{operationalNote(booking)}</p>
          {booking.customer_notes ? <p className="provider-customer-note">{t('provider.customerNote')}: {booking.customer_notes}</p> : null}
          <div className="provider-booking-footer"><Badge tone="neutral">{t('common.payment')} {status(booking.payment_status)}</Badge><div className="provider-actions">
            <Link className="button button-secondary" href={`/provider/bookings/${encodeURIComponent(booking.id)}`}>{t('provider.viewDetails')}</Link>
            {actionableRequest ? <><Button type="button" variant="secondary" disabled={busyId === booking.id} onClick={() => void act(booking.id, 'accept')}>{busyId === booking.id ? t('provider.updating') : rescheduleRequest ? t('provider.acceptNewTime') : t('provider.accept')}</Button><Button type="button" variant="quiet" disabled={busyId === booking.id} onClick={() => setDeclineTarget(booking)}>{rescheduleRequest ? t('provider.declineNewTime') : t('provider.decline')}</Button></> : null}
            {completionDue ? <Button type="button" disabled={busyId === booking.id} onClick={() => void act(booking.id, 'complete')}>{busyId === booking.id ? t('provider.updating') : t('provider.markCompleted')}</Button> : null}
          </div></div>
        </Card>;
      })}
    </div> : <Card><EmptyState title={queue === 'action' ? t('provider.nothingAction') : t('provider.noMatch')}>{queue === 'action' ? t('provider.actionEmptyHelp') : t('provider.filterEmptyHelp')}</EmptyState></Card>}

    <BookingReasonDialog
      open={Boolean(declineTarget)}
      eyebrow={declineTarget?.status === 'rescheduled' ? t('provider.declineNewTime') : t('provider.declineBooking')}
      title={declineTarget ? (declineTarget.status === 'rescheduled' ? `${t('provider.declineNewTime')}: ${declineTarget.service_name}?` : `${t('provider.declineBooking')}: ${declineTarget.service_name}?`) : `${t('provider.declineBooking')}?`}
      description={declineTarget?.status === 'rescheduled' ? t('provider.declineNewTimeHelp') : t('provider.declineBookingHelp')}
      options={(declineTarget?.status === 'rescheduled' ? rescheduleDeclineReasonKeys : declineReasonKeys).map((key) => t(key))}
      confirmLabel={declineTarget?.status === 'rescheduled' ? t('provider.declineNewTime') : t('provider.declineBooking')}
      busy={Boolean(declineTarget && busyId === declineTarget.id)}
      onClose={() => setDeclineTarget(null)}
      onConfirm={async (reason) => { if (!declineTarget) return; if (await act(declineTarget.id, 'decline', reason)) setDeclineTarget(null); }}
    />
  </LiveProviderShell>;
}