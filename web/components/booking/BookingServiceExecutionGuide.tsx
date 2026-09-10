'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Card } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

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
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(epoch));
  } catch {
    return new Date(epoch).toLocaleString();
  }
}

export default function BookingServiceExecutionGuide({ bookingId, viewer }: { bookingId: string; viewer: 'customer' | 'provider' }) {
  const { locale } = useLanguage();
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
      } catch { /* Guidance is optional and must never block booking detail. */ }
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

  const tamil = locale.toLowerCase().startsWith('ta');
  const beforeStart = now < timing.startAt;
  const inService = now >= timing.startAt && now < timing.endAt;
  const phase = beforeStart ? 'prepare' : inService ? 'service' : 'completion';
  const moment = formatMoment(beforeStart ? timing.startAt : timing.endAt, locale, timing.zone);

  const copy = viewer === 'provider'
    ? phase === 'prepare'
      ? {
          title: tamil ? 'Service confirmed — தயாராகுங்கள்' : 'Service confirmed — prepare to deliver',
          body: tamil
            ? `Customer booking confirm ஆகிவிட்டது. ${moment}க்கு service தொடங்க தயாராக இருந்து, தேவையான service details-ஐ முன்பே coordinate செய்யுங்கள்.`
            : `The customer booking is confirmed. Be ready to start the service at ${moment} and coordinate any remaining service details beforehand.`,
          note: tamil ? 'Service window முடியும் வரை completion action lock ஆகவே இருக்கும்.' : 'The completion action stays locked until the scheduled service window ends.',
        }
      : phase === 'service'
        ? {
            title: tamil ? 'Service window இப்போது நடைபெறுகிறது' : 'Service window is now in progress',
            body: tamil ? 'ஒப்புக்கொண்ட service-ஐ வழங்கி, customer உடன் தேவையான coordination-ஐ தொடருங்கள்.' : 'Deliver the agreed service and keep the customer updated if any coordination is needed.',
            note: tamil ? `Scheduled end: ${moment}. அதற்கு பிறகு service முடிந்திருந்தால் “Mark complete” பயன்படுத்தலாம்.` : `Scheduled end: ${moment}. After that, use “Mark complete” only if the service was actually delivered.`,
          }
        : {
            title: tamil ? 'Service window முடிந்தது — record-ஐ finish செய்யுங்கள்' : 'Service window ended — finish the service record',
            body: tamil ? 'Service உண்மையாக முடிந்திருந்தால் கீழே உள்ள Next action-ல் “Mark complete” செய்யுங்கள். ஏதேனும் unresolved issue இருந்தால் complete செய்யாமல் coordination தொடருங்கள்.' : 'If the service was actually delivered, use “Mark complete” in the Next action below. If anything remains unresolved, keep coordinating instead of closing it.',
            note: tamil ? `Scheduled end: ${moment}` : `Scheduled end: ${moment}`,
          }
    : phase === 'prepare'
      ? {
          title: tamil ? 'Booking confirmed — service-க்கு தயாராகுங்கள்' : 'Booking confirmed — get ready for service',
          body: tamil ? `Provider உங்கள் booking-ஐ confirm செய்துள்ளார். ${moment}க்கு service location-ல் தயாராக இருங்கள்; timing அல்லது service details மாறினால் coordination option-ஐ பயன்படுத்துங்கள்.` : `Your provider confirmed the booking. Be ready at the service location for ${moment}; use the available coordination option if timing or service details need clarification.`,
          note: tamil ? 'அடுத்த stage: scheduled service.' : 'Next stage: scheduled service.',
        }
      : phase === 'service'
        ? {
            title: tamil ? 'Service window இப்போது நடைபெறுகிறது' : 'Service window is now in progress',
            body: tamil ? 'Service நடைபெறும் நேரம் இது. ஏதேனும் clarification தேவைப்பட்டால் Provider உடன் coordination தொடருங்கள்.' : 'This is the scheduled service window. Keep coordinating with the provider if anything needs clarification.',
            note: tamil ? `Scheduled end: ${moment}` : `Scheduled end: ${moment}`,
          }
        : {
            title: tamil ? 'Scheduled service window முடிந்தது' : 'Scheduled service window has ended',
            body: tamil ? 'Service முடிந்திருந்தால் Provider completion record update செய்வார். Service இன்னும் முடியவில்லை அல்லது issue இருந்தால் coordination தொடருங்கள்; தேவையானால் support பயன்படுத்துங்கள்.' : 'If the service finished, the provider will update the completion record. If it is still unresolved, keep coordinating and use support if needed.',
            note: tamil ? `Scheduled end: ${moment}` : `Scheduled end: ${moment}`,
          };

  return <Card className={viewer === 'provider' ? 'provider-detail-card' : 'detail-status-card'}>
    <div className="section-heading">
      <div><span className="eyebrow">Service execution</span><h2>{copy.title}</h2></div>
      <Badge tone={phase === 'prepare' ? 'info' : phase === 'service' ? 'success' : 'warning'}>
        {phase === 'prepare' ? 'Prepare' : phase === 'service' ? 'In service' : 'Completion due'}
      </Badge>
    </div>
    <p className="detail-copy">{copy.body}</p>
    <p className="summary-note">{copy.note}</p>
  </Card>;
}
