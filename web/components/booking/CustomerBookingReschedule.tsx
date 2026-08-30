'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import BookingReasonDialog from './BookingReasonDialog';
import { getBookingThroughConfiguredRepository, rescheduleBookingThroughConfiguredRepository } from '../../services/booking-repository';
import type { CustomerBooking } from '../../types/booking-domain';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

type Slot = { time: string; available: boolean; reason?: string };
type Day = { date: string; label: string; slots: Slot[] };
type AvailabilityResponse = { days?: Day[]; timezone?: string; error?: string };

const rescheduleReasons = ['Timing no longer works', 'Work or personal commitment', 'Travel or delay', 'Need a different day', 'Other'];

function to24Hour(label: string) {
  const match = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return label;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = match[3].toUpperCase();
  if (suffix === 'AM' && hour === 12) hour = 0;
  if (suffix === 'PM' && hour !== 12) hour += 12;
  return `${String(hour).padStart(2, '0')}:${minute}:00`;
}

function isCurrentSlot(booking: CustomerBooking, date: string, timeLabel: string) {
  return booking.bookingDate === date && booking.startTime.slice(0, 5) === to24Hour(timeLabel).slice(0, 5);
}

export default function CustomerBookingReschedule({ bookingId }: { bookingId: string }) {
  const { t, locale } = useRemainingWorkspaceTranslations();
  const [booking, setBooking] = useState<CustomerBooking>();
  const [days, setDays] = useState<Day[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reasonOpen, setReasonOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const current = await getBookingThroughConfiguredRepository(bookingId as CustomerBooking['bookingId']);
        if (!current) throw new Error('Booking not found.');
        if (!['pending', 'confirmed', 'rescheduled'].includes(current.status)) throw new Error(`This ${current.status} booking cannot be rescheduled.`);
        const response = await fetch(`/api/bookings/${encodeURIComponent(current.bookingId)}/availability`, { cache: 'no-store' });
        const payload = await response.json() as AvailabilityResponse;
        if (!response.ok) throw new Error(payload.error ?? 'Unable to load availability.');
        if (cancelled) return;
        setBooking(current);
        setDays(payload.days ?? []);
        const first = (payload.days ?? []).find((day) => day.slots.some((slot) => slot.available && !isCurrentSlot(current, day.date, slot.time)));
        setSelectedDate(first?.date ?? '');
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load rescheduling.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  const day = useMemo(() => days.find((item) => item.date === selectedDate), [days, selectedDate]);

  const submit = async (reason: string) => {
    if (!booking || !selectedDate || !selectedTime || busy) return;
    setBusy(true); setError('');
    try {
      const updated = await rescheduleBookingThroughConfiguredRepository(booking.bookingId, selectedDate, to24Hour(selectedTime), reason);
      if (!updated) throw new Error('Booking could not be rescheduled.');
      window.location.assign(`/bookings/${encodeURIComponent(updated.bookingId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Booking could not be rescheduled.');
      setBusy(false);
    }
  };

  const formatDay = (value: string) => {
    try {
      const date = new Date(`${value}T00:00:00`);
      return {
        weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date),
        date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date),
      };
    } catch { return { weekday: value, date: '' }; }
  };

  const statusLabel = (status: string) => locale === 'ta-IN'
    ? ({ pending: 'நிலுவையில்', confirmed: 'உறுதிப்படுத்தப்பட்டது', rescheduled: 'நேர மாற்ற கோரிக்கை' }[status] ?? status)
    : status;

  if (loading) return <div className="booking-detail-page"><Card><p>{t('reschedule.loading')}</p></Card></div>;
  if (!booking) return <EmptyState title={t('reschedule.unavailable')}>{error || 'Booking not found.'}</EmptyState>;

  return <div className="booking-detail-page">
    <section className="booking-detail-heading">
      <div>
        <span className="eyebrow">{t('reschedule.eyebrow')}</span>
        <h1>{booking.serviceName}</h1>
        <p>{t('reschedule.currentTime')}: {booking.bookingDate} · {booking.startTime} {booking.timezone}</p>
      </div>
      <Badge tone="info">{statusLabel(booking.status)}</Badge>
    </section>
    <div className="booking-detail-layout">
      <main>
        <Card className="policy-card">
          <span className="eyebrow">{t('reschedule.liveAvailability')}</span>
          <h2>{t('reschedule.chooseNew')}</h2>
          <p className="detail-copy">{t('reschedule.help')}</p>
          <div className="date-options">
            {days.map((item) => {
              const count = item.slots.filter((slot) => slot.available && !isCurrentSlot(booking, item.date, slot.time)).length;
              const formatted = formatDay(item.date);
              return <button key={item.date} type="button" className={`date-option ${selectedDate === item.date ? 'date-selected' : ''}`} disabled={!count} onClick={() => { setSelectedDate(item.date); setSelectedTime(''); }}>
                <strong>{formatted.weekday}</strong>
                <span>{formatted.date}</span>
                <small>{count ? `${count} ${t('reschedule.alternativeTimes')}` : t('reschedule.noAlternative')}</small>
              </button>;
            })}
          </div>
          {day ? <div className="time-options" style={{ marginTop: '1rem' }}>
            {day.slots.map((slot) => {
              const current = isCurrentSlot(booking, day.date, slot.time);
              return <button
                key={slot.time}
                type="button"
                className="time-option"
                disabled={!slot.available || current}
                aria-pressed={selectedTime === slot.time}
                title={current ? t('reschedule.currentBookingTime') : slot.reason}
                onClick={() => setSelectedTime(slot.time)}
              >{slot.time}{current ? ` · ${t('reschedule.current')}` : ''}</button>;
            })}
          </div> : null}
          {error ? <p role="alert" className="field-error">{error}</p> : null}
        </Card>
      </main>
      <aside className="booking-detail-aside">
        <Card>
          <span className="eyebrow">{t('reschedule.newSelection')}</span>
          <p>{selectedDate || t('reschedule.chooseDate')}{selectedTime ? ` · ${selectedTime}` : ''}</p>
          <Button type="button" disabled={!selectedDate || !selectedTime || busy} onClick={() => setReasonOpen(true)}>{busy ? t('reschedule.working') : t('reschedule.continue')}</Button>
          <Link href={`/bookings/${encodeURIComponent(booking.bookingId)}`} className="button button-secondary">{t('reschedule.keep')}</Link>
        </Card>
        <p className="support-note">{t('reschedule.revalidate')}</p>
      </aside>
    </div>
    <BookingReasonDialog
      open={reasonOpen}
      eyebrow={t('reschedule.request')}
      title={t('reschedule.why')}
      description={`${selectedDate}${selectedTime ? ` · ${selectedTime}` : ''} ${t('reschedule.providerConfirm')}`}
      options={rescheduleReasons}
      confirmLabel={t('reschedule.requestNew')}
      busy={busy}
      onClose={() => setReasonOpen(false)}
      onConfirm={submit}
    />
  </div>;
}
