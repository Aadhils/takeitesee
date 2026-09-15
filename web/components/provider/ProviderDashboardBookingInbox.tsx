'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card } from '../ui/primitives';
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
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const copy = useMemo(() => tamil ? {
    eyebrow: 'Booking inbox',
    title: 'Customer booking next actions',
    intro: 'புதிய booking request, reschedule, completion due மற்றும் முக்கிய follow-up மட்டும் இங்கே சுருக்கமாக காட்டப்படும். Complex booking actions dedicated Booking workspace-ல் தொடரும்.',
    all: 'All bookings',
    emptyTitle: 'இப்போது booking action இல்லை',
    emptyBody: 'Real customer booking வந்ததும் Provider next action இங்கே தோன்றும்.',
    loading: 'Booking inbox load ஆகிறது…',
    retry: 'Retry',
    request: 'Response needed',
    completion: 'Completion due',
    upcoming: 'Upcoming',
    followup: 'Follow-up',
    open: 'Open booking',
    pendingCount: 'needs action',
    upcomingCount: 'upcoming',
  } : {
    eyebrow: 'Booking inbox',
    title: 'Customer booking next actions',
    intro: 'See new booking requests, reschedules, completion-due work and important follow-up here. Complex booking actions stay in the dedicated Booking workspace.',
    all: 'All bookings',
    emptyTitle: 'No booking action right now',
    emptyBody: 'When a real customer booking arrives, the Provider next action will appear here.',
    loading: 'Loading booking inbox…',
    retry: 'Retry',
    request: 'Response needed',
    completion: 'Completion due',
    upcoming: 'Upcoming',
    followup: 'Follow-up',
    open: 'Open booking',
    pendingCount: 'needs action',
    upcomingCount: 'upcoming',
  }, [tamil]);

  const [bookings, setBookings] = useState<ProviderBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/bookings', { cache: 'no-store' });
      const body = await response.json() as { bookings?: ProviderBooking[]; error?: string };
      if (!response.ok || !Array.isArray(body.bookings)) throw new Error(body.error ?? 'Unable to load provider bookings.');
      setBookings(body.bookings);
    } catch (cause) {
      setBookings([]);
      setError(cause instanceof Error ? cause.message : 'Unable to load provider bookings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
    if (kind === 'request') return copy.request;
    if (kind === 'completion') return copy.completion;
    if (kind === 'followup') return copy.followup;
    return copy.upcoming;
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

  return <section id="provider-booking-inbox" className={styles.center} aria-label="Provider booking inbox">
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.intro}</p>
        </div>
        <Link href="/provider/bookings" className={styles.secondaryLink}>{copy.all}</Link>
      </div>

      {loading ? <p className={styles.status}>{copy.loading}</p> : null}
      {error ? <p className="field-error" role="alert">{error} <button type="button" className={styles.textButton} onClick={() => void load()}>{copy.retry}</button></p> : null}

      {!loading && !error ? <div className={styles.counts}>
        <span><strong>{needsActionCount}</strong> {copy.pendingCount}</span>
        <span><strong>{upcomingCount}</strong> {copy.upcomingCount}</span>
      </div> : null}

      {!loading && !error && visible.length === 0 ? <div className={styles.empty}>
        <strong>{copy.emptyTitle}</strong>
        <p>{copy.emptyBody}</p>
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
          <Link href={`/provider/bookings/${booking.id}`} className={styles.openLink}>{copy.open} →</Link>
        </article>)}
      </div> : null}

      {attention.length > MAX_ATTENTION_ITEMS ? <Link href="/provider/bookings" className={styles.moreLink}>{copy.all} →</Link> : null}
    </Card>
  </section>;
}
