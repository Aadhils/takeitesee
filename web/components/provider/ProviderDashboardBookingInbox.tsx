'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './ProviderDashboardBookingInbox.module.css';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
type AttendanceOutcome = 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';
type ProviderBooking = {
  id: string;
  booking_reference: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  timezone: string;
  duration_minutes: number;
  location: string;
  status: BookingStatus;
  attendance_outcome: AttendanceOutcome;
  closeout_state?: 'open' | 'awaiting_customer' | 'support_open' | 'eligible_to_close' | 'closed';
};

type AttentionKind = 'request' | 'completion' | 'upcoming' | 'followup';

const MAX_ATTENTION_ITEMS = 3;

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
      const representedUtc = Date.UTC(
        Number(values.year), Number(values.month) - 1, Number(values.day),
        Number(values.hour), Number(values.minute), Number(values.second),
      );
      guess += targetUtc - representedUtc;
    }
    return guess;
  } catch {
    return new Date(`${date}T${time.slice(0, 8)}Z`).getTime();
  }
}

function bookingEndEpoch(booking: ProviderBooking) {
  return zonedDateTimeToEpoch(booking.booking_date, booking.start_time, booking.timezone || 'Asia/Kolkata')
    + booking.duration_minutes * 60_000;
}

function attentionKind(booking: ProviderBooking, now: number): AttentionKind | null {
  if (booking.closeout_state === 'support_open' || booking.closeout_state === 'eligible_to_close') return 'followup';
  if (booking.status === 'pending' || booking.status === 'rescheduled') return 'request';
  if (booking.status === 'confirmed' && booking.attendance_outcome === 'pending') {
    return bookingEndEpoch(booking) <= now ? 'completion' : 'upcoming';
  }
  if (booking.status === 'completed' && booking.closeout_state === 'awaiting_customer') return 'followup';
  return null;
}

function priority(kind: AttentionKind) {
  if (kind === 'request') return 0;
  if (kind === 'completion') return 1;
  if (kind === 'followup') return 2;
  return 3;
}

export default function ProviderDashboardBookingInbox() {
  const { locale, t } = useIdentityWorkspaceTranslations();

  const [bookings, setBookings] = useState<ProviderBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setNow(Date.now());
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/bookings', { cache: 'no-store' });
      const body = await response.json() as { bookings?: ProviderBooking[]; error?: string };
      if (!response.ok || !Array.isArray(body.bookings)) throw new Error(body.error ?? t('provider.bookingInbox.loadFallback'));
      setBookings(body.bookings);
    } catch (cause) {
      setBookings([]);
      setError(cause instanceof Error ? cause.message : t('provider.bookingInbox.loadFallback'));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refreshVisibleInbox = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', refreshVisibleInbox);
    document.addEventListener('visibilitychange', refreshVisibleInbox);
    return () => {
      window.removeEventListener('focus', refreshVisibleInbox);
      document.removeEventListener('visibilitychange', refreshVisibleInbox);
    };
  }, [load]);

  const attention = useMemo(() => bookings
    .map((booking) => ({ booking, kind: attentionKind(booking, now) }))
    .filter((entry): entry is { booking: ProviderBooking; kind: AttentionKind } => Boolean(entry.kind))
    .sort((left, right) => {
      const priorityDifference = priority(left.kind) - priority(right.kind);
      if (priorityDifference) return priorityDifference;
      return zonedDateTimeToEpoch(left.booking.booking_date, left.booking.start_time, left.booking.timezone || 'Asia/Kolkata')
        - zonedDateTimeToEpoch(right.booking.booking_date, right.booking.start_time, right.booking.timezone || 'Asia/Kolkata');
    }), [bookings, now]);

  const needsActionCount = attention.filter((entry) => entry.kind !== 'upcoming').length;
  const upcomingCount = attention.filter((entry) => entry.kind === 'upcoming').length;
  const visible = attention.slice(0, MAX_ATTENTION_ITEMS);

  const kindLabel = (kind: AttentionKind) => {
    if (kind === 'request') return t('provider.bookingInbox.request');
    if (kind === 'completion') return t('provider.bookingInbox.completion');
    if (kind === 'followup') return t('provider.bookingInbox.followup');
    return t('provider.bookingInbox.upcoming');
  };

  const kindTone = (kind: AttentionKind): 'warning' | 'info' | 'success' => {
    if (kind === 'request' || kind === 'completion' || kind === 'followup') return 'warning';
    return 'success';
  };

  const formatSchedule = (booking: ProviderBooking) => {
    const date = new Date(zonedDateTimeToEpoch(booking.booking_date, booking.start_time, booking.timezone || 'Asia/Kolkata'));
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium', timeStyle: 'short', timeZone: booking.timezone || 'Asia/Kolkata',
      }).format(date);
    } catch {
      return `${booking.booking_date} · ${booking.start_time.slice(0, 5)}`;
    }
  };

  return <section id="provider-booking-inbox" className={styles.center} aria-label={t('provider.bookingInbox.controlsLabel')}>
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{t('provider.bookingInbox.eyebrow')}</span>
          <h2>{t('provider.bookingInbox.title')}</h2>
          <p>{t('provider.bookingInbox.intro')}</p>
        </div>
        <div className={styles.headerActions}>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => void load()}>{loading ? t('provider.bookingInbox.refreshing') : t('provider.bookingInbox.refresh')}</Button>
          <Link href="/provider/bookings" className={styles.secondaryLink}>{t('provider.bookingInbox.all')}</Link>
        </div>
      </div>

      {loading ? <p className={styles.status}>{t('provider.bookingInbox.loading')}</p> : null}
      {error ? <p className="field-error" role="alert">{error} <button type="button" className={styles.textButton} onClick={() => void load()}>{t('provider.bookingInbox.retry')}</button></p> : null}

      {!loading && !error ? <div className={styles.counts}>
        <span><strong>{needsActionCount}</strong> {t('provider.bookingInbox.needsAction')}</span>
        <span><strong>{upcomingCount}</strong> {t('provider.bookingInbox.upcoming')Count}</span>
      </div> : null}

      {!loading && !error && visible.length === 0 ? <div className={styles.empty}>
        <strong>{t('provider.bookingInbox.emptyTitle')}</strong>
        <p>{t('provider.bookingInbox.emptyBody')}</p>
      </div> : null}

      {visible.length ? <div className={styles.list}>
        {visible.map(({ booking, kind }) => <article className={styles.item} key={booking.id}>
          <div className={styles.itemMain}>
            <div className={styles.itemTitle}>
              <strong>{booking.service_name}</strong>
              <Badge tone={kindTone(kind)}>{kindLabel(kind)}</Badge>
            </div>
            <p>{booking.booking_reference} · {formatSchedule(booking)}</p>
            {booking.location ? <small>{booking.location}</small> : null}
          </div>
          <Link href={`/provider/bookings/${booking.id}`} className={styles.openLink}>{t('provider.bookingInbox.open')} →</Link>
        </article>)}
      </div> : null}

      {attention.length > MAX_ATTENTION_ITEMS ? <Link href="/provider/bookings" className={styles.moreLink}>{t('provider.bookingInbox.all')} →</Link> : null}
    </Card>
  </section>;
}
