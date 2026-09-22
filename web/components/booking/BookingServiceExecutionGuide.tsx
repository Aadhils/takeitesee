'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../ui/primitives';
import { useBookingServiceExecutionTranslations, type BookingServiceExecutionKey } from '../i18n/BookingServiceExecutionTranslations';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
type AttendanceOutcome = 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';
type BookingSnapshot = {
  booking_date: string;
  start_time: string;
  timezone: string;
  duration_minutes: number;
  status: BookingStatus;
  attendance_outcome?: AttendanceOutcome;
};

function zonedDateTimeToEpoch(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.slice(0, 8).split(':').map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = targetUtc;

  for (let index = 0; index < 3; index += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    guess += targetUtc - representedUtc;
  }

  return guess;
}

function formatMoment(epoch: number, locale: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(epoch));
  } catch {
    return new Date(epoch).toLocaleString();
  }
}

export default function BookingServiceExecutionGuide({ bookingId, viewer }: { bookingId: string; viewer: 'customer' | 'provider' }) {
  const { locale, t } = useBookingServiceExecutionTranslations();
  const [booking, setBooking] = useState<BookingSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const path = viewer === 'provider'
          ? `/api/provider/bookings/${encodeURIComponent(bookingId)}`
          : `/api/bookings/${encodeURIComponent(bookingId)}`;
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json() as { booking?: BookingSnapshot };
        if (active) setBooking(payload.booking ?? null);
      } catch { /* Optional guidance must never block the booking or requirement context. */ }
    })();
    return () => { active = false; };
  }, [bookingId, viewer]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const timing = useMemo(() => {
    if (!booking) return null;
    try {
      const zone = booking.timezone || 'Asia/Kolkata';
      const startAt = zonedDateTimeToEpoch(booking.booking_date, booking.start_time, zone);
      const endAt = startAt + Math.max(Number(booking.duration_minutes) || 0, 0) * 60_000;
      return { startAt, endAt, zone };
    } catch {
      return null;
    }
  }, [booking]);

  if (!booking || booking.status !== 'confirmed' || (booking.attendance_outcome && booking.attendance_outcome !== 'pending') || !timing) return null;

  const beforeStart = now < timing.startAt;
  const inService = now >= timing.startAt && now < timing.endAt;
  const phase = beforeStart ? 'prepare' : inService ? 'service' : 'completion';
  const moment = formatMoment(beforeStart ? timing.startAt : timing.endAt, locale, timing.zone);
  const copyPrefix = `execution.${viewer}.${phase}`;
  const copy = {
    title: t(`${copyPrefix}.title` as BookingServiceExecutionKey, { moment }),
    body: t(`${copyPrefix}.body` as BookingServiceExecutionKey, { moment }),
    note: t(`${copyPrefix}.note` as BookingServiceExecutionKey, { moment }),
  };
  const badge = phase === 'prepare'
    ? t('execution.badge.prepare')
    : phase === 'service'
      ? t('execution.badge.inService')
      : t('execution.badge.completionDue');

  return <div style={{ borderTop: '1px solid #e7eaf0', marginTop: '1rem', paddingTop: '1rem', display: 'grid', gap: '.55rem' }}>
    <div className="section-heading">
      <div><span className="eyebrow">{t('execution.eyebrow')}</span><h3 style={{ margin: 0 }}>{copy.title}</h3></div>
      <Badge tone={phase === 'prepare' ? 'info' : phase === 'service' ? 'success' : 'warning'}>{badge}</Badge>
    </div>
    <p className="detail-copy" style={{ margin: 0 }}>{copy.body}</p>
    <p className="summary-note" style={{ margin: 0 }}>{copy.note}</p>
  </div>;
}
