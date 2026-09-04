'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
import BookingAuditTimeline from '../booking/BookingAuditTimeline';
import BookingCloseoutPanel from '../booking/BookingCloseoutPanel';
import BookingReasonDialog from '../booking/BookingReasonDialog';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import ProviderCashCollectionPanel from './ProviderCashCollectionPanel';
import ProviderRequirementOccurrenceContext from './ProviderRequirementOccurrenceContext';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
type AttendanceOutcome = 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';
type Booking = {
  id: string; booking_reference: string; service_name: string; booking_date: string; start_time: string; timezone: string;
  duration_minutes: number; location: string; customer_notes?: string; quoted_price: number; currency: 'INR' | 'USD';
  status: BookingStatus; payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded'; provider_name: string;
  created_at: string; updated_at: string; attendance_outcome: AttendanceOutcome; closeout_state?: string; closed_at?: string;
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
  const { t, locale } = useRemainingWorkspaceTranslations();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadBooking = useCallback(async () => {
    try {
      const response = await fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, { cache: 'no-store' });
      const payload = await response.json() as { booking?: Booking; error?: string };
      if (!response.ok || !payload.booking) throw new Error(payload.error ?? 'Unable to load booking.');
      setBooking(payload.booking);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load booking.'); }
  }, [bookingId]);

  useEffect(() => { void loadBooking(); }, [loadBooking]);
  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ bookingId?: string }>).detail;
      if (!detail?.bookingId || detail.bookingId === bookingId) void loadBooking();
    };
    window.addEventListener('booking:provider-list-refresh', refresh);
    return () => window.removeEventListener('booking:provider-list-refresh', refresh);
  }, [bookingId, loadBooking]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const completion = useMemo(() => {
    if (!booking || booking.status !== 'confirmed' || booking.attendance_outcome !== 'pending') return null;
    const start = zonedDateTimeToEpoch(booking.booking_date, booking.start_time, booking.timezone || 'Asia/Kolkata');
    const eligibleAt = start + booking.duration_minutes * 60_000;
    return {
      eligibleAt,
      allowed: now >= eligibleAt,
      label: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: booking.timezone || 'Asia/Kolkata' }).format(new Date(eligibleAt)),
    };
  }, [booking, now, locale]);

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

  const statusLabel = (status: BookingStatus) => locale === 'ta-IN'
    ? ({ pending: 'நிலுவையில்', confirmed: 'உறுதிப்படுத்தப்பட்டது', completed: 'முடிந்தது', cancelled: 'ரத்து செய்யப்பட்டது', rescheduled: 'நேர மாற்ற கோரிக்கை' }[status])
    : status;
  const attendanceLabel = (status: AttendanceOutcome) => locale === 'ta-IN'
    ? ({ pending: 'வருகை நிலுவையில்', service_completed: 'சேவை முடிந்தது', customer_no_show: 'வாடிக்கையாளர் வரவில்லை', provider_no_show: 'வழங்குநர் வரவில்லை' }[status])
    : status.replaceAll('_', ' ');

  const rescheduleRequest = booking?.status === 'rescheduled';
  const attendanceTerminal = booking?.attendance_outcome === 'customer_no_show' || booking?.attendance_outcome === 'provider_no_show';

  return <LiveProviderShell active="/provider/bookings">
    <Link href="/provider/bookings">← {t('providerBooking.back')}</Link>
    <ProviderHeading eyebrow={booking?.booking_reference ?? t('providerBooking.fallbackEyebrow')} title={booking?.service_name ?? t('providerBooking.fallbackTitle')} description={t('providerBooking.intro')} />
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {!booking ? <Card><p>{error ? t('providerBooking.loadFailed') : t('providerBooking.loading')}</p></Card> : <div className="provider-detail-grid">
      <Card className="provider-detail-card">
        <div className="section-heading"><div><span className="eyebrow">{t('providerBooking.serviceDetails')}</span><h2>{booking.service_name}</h2></div><Badge tone={attendanceTerminal ? 'warning' : tone(booking.status)}>{attendanceTerminal ? attendanceLabel(booking.attendance_outcome) : rescheduleRequest ? statusLabel('rescheduled') : statusLabel(booking.status)}</Badge></div>
        <dl className="provider-profile-details">
          <div><dt>{t('providerBooking.provider')}</dt><dd>{booking.provider_name}</dd></div><div><dt>{t('providerBooking.dateTime')}</dt><dd>{booking.booking_date}, {booking.start_time} {booking.timezone}</dd></div>
          <div><dt>{t('providerBooking.duration')}</dt><dd>{booking.duration_minutes} {t('providerBooking.minutes')}</dd></div><div><dt>{t('providerBooking.location')}</dt><dd>{booking.location}</dd></div>
          <div><dt>{t('providerBooking.price')}</dt><dd>{new Intl.NumberFormat(locale, { style: 'currency', currency: booking.currency }).format(booking.quoted_price)}</dd></div>
          <div><dt>{t('providerBooking.customerNote')}</dt><dd>{booking.customer_notes || t('providerBooking.noNote')}</dd></div>
        </dl><Badge tone="neutral">{t('providerBooking.payment')} {booking.payment_status}</Badge>
      </Card>
      <ProviderRequirementOccurrenceContext bookingId={booking.id} locale={locale} />
      <Card className="provider-detail-card"><span className="eyebrow">{t('providerBooking.nextAction')}</span><h2>{t('providerBooking.controls')}</h2>
        {booking.status === 'pending' ? <><p>{t('providerBooking.pendingHelp')}</p><div className="provider-actions"><Button type="button" disabled={busy} onClick={() => void act('accept')}>{t('providerBooking.accept')}</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => setDeclineOpen(true)}>{t('providerBooking.decline')}</Button></div></> : null}
        {booking.status === 'rescheduled' ? <><p>{t('providerBooking.rescheduleHelp')}</p><div className="provider-actions"><Button type="button" disabled={busy} onClick={() => void act('accept')}>{t('providerBooking.acceptNew')}</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => setDeclineOpen(true)}>{t('providerBooking.declineNew')}</Button></div></> : null}
        {booking.status === 'confirmed' && attendanceTerminal ? <p>{t('providerBooking.attendanceTerminal')}</p> : null}
        {booking.status === 'confirmed' && !attendanceTerminal ? <>{completion?.allowed ? <><p>{t('providerBooking.canComplete')}</p><Button type="button" disabled={busy} onClick={() => void act('complete')}>{busy ? t('reason.updating') : t('providerBooking.markComplete')}</Button></> : <><p>{t('providerBooking.completeOnlyAfter')}</p><p className="summary-note">{t('providerBooking.completionAfter')} {completion?.label}.</p><Button type="button" disabled>{t('providerBooking.markComplete')}</Button></>}</> : null}
        {booking.status === 'completed' ? <p>{t('providerBooking.completedHelp')}</p> : null}
        {booking.status === 'cancelled' ? <p>{t('providerBooking.cancelledHelp')}</p> : null}
      </Card>
      <ProviderCashCollectionPanel bookingId={booking.id} bookingStatus={booking.status} paymentStatus={booking.payment_status} amount={booking.quoted_price} currency={booking.currency} onUpdated={loadBooking} />
      <div style={{ gridColumn: '1 / -1' }}><BookingCloseoutPanel bookingId={booking.id} viewer="provider" /></div>
      <div style={{ gridColumn: '1 / -1' }}>
        <BookingAuditTimeline bookingId={booking.id} refreshKey={booking.updated_at} title={t('providerBooking.timelineTitle')} description={t('providerBooking.timelineHelp')} />
      </div>
    </div>}
    <BookingReasonDialog
      open={declineOpen}
      eyebrow={rescheduleRequest ? t('providerBooking.declineNew') : t('providerBooking.decline')}
      title={rescheduleRequest ? t('providerBooking.declineWhyNew') : t('providerBooking.declineWhy')}
      description={rescheduleRequest ? t('providerBooking.declineNewHelp') : t('providerBooking.declineHelp')}
      options={rescheduleRequest ? rescheduleDeclineReasons : declineReasons}
      confirmLabel={rescheduleRequest ? t('providerBooking.declineNew') : t('providerBooking.decline')}
      busy={busy}
      onClose={() => setDeclineOpen(false)}
      onConfirm={async (reason) => { if (await act('decline', reason)) setDeclineOpen(false); }}
    />
  </LiveProviderShell>;
}
