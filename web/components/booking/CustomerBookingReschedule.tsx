'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { getBookingThroughConfiguredRepository, rescheduleBookingThroughConfiguredRepository } from '../../services/booking-repository';
import type { CustomerBooking } from '../../types/booking-domain';

type Slot = { time: string; available: boolean; reason?: string };
type Day = { date: string; label: string; slots: Slot[] };
type AvailabilityResponse = { days?: Day[]; timezone?: string; error?: string };

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

export default function CustomerBookingReschedule({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<CustomerBooking>();
  const [days, setDays] = useState<Day[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const current = await getBookingThroughConfiguredRepository(bookingId as CustomerBooking['bookingId']);
        if (!current) throw new Error('Booking not found.');
        if (!['pending', 'confirmed', 'rescheduled'].includes(current.status)) throw new Error(`This ${current.status} booking cannot be rescheduled.`);
        const response = await fetch(`/api/services/${encodeURIComponent(current.serviceId)}/availability`, { cache: 'no-store' });
        const payload = await response.json() as AvailabilityResponse;
        if (!response.ok) throw new Error(payload.error ?? 'Unable to load availability.');
        if (cancelled) return;
        setBooking(current);
        setDays(payload.days ?? []);
        const first = (payload.days ?? []).find((day) => day.slots.some((slot) => slot.available));
        setSelectedDate(first?.date ?? '');
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load rescheduling.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  const day = useMemo(() => days.find((item) => item.date === selectedDate), [days, selectedDate]);

  const submit = async () => {
    if (!booking || !selectedDate || !selectedTime || busy) return;
    setBusy(true); setError('');
    try {
      const updated = await rescheduleBookingThroughConfiguredRepository(booking.bookingId, selectedDate, to24Hour(selectedTime));
      if (!updated) throw new Error('Booking could not be rescheduled.');
      window.location.assign(`/bookings/${encodeURIComponent(updated.bookingId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Booking could not be rescheduled.');
      setBusy(false);
    }
  };

  if (loading) return <div className="booking-detail-page"><Card><p>Loading live availability…</p></Card></div>;
  if (!booking) return <EmptyState title="Rescheduling unavailable">{error || 'Booking not found.'}</EmptyState>;

  return <div className="booking-detail-page">
    <section className="booking-detail-heading"><div><span className="eyebrow">Reschedule booking</span><h1>{booking.serviceName}</h1><p>Current time: {booking.bookingDate} · {booking.startTime} {booking.timezone}</p></div><Badge tone="info">{booking.status}</Badge></section>
    <div className="booking-detail-layout"><main><Card className="policy-card"><span className="eyebrow">Live provider availability</span><h2>Choose a new date and time</h2><div className="date-options">{days.map((item) => { const count = item.slots.filter((slot) => slot.available).length; return <button key={item.date} type="button" className={`date-option ${selectedDate === item.date ? 'date-selected' : ''}`} disabled={!count} onClick={() => { setSelectedDate(item.date); setSelectedTime(''); }}><strong>{item.label.split(',')[0]}</strong><span>{item.label.split(',').slice(1).join(',').trim()}</span><small>{count ? `${count} times` : 'Unavailable'}</small></button>; })}</div>{day ? <div className="time-options" style={{ marginTop: '1rem' }}>{day.slots.map((slot) => <button key={slot.time} type="button" className="time-option" disabled={!slot.available} aria-pressed={selectedTime === slot.time} onClick={() => setSelectedTime(slot.time)}>{slot.time}</button>)}</div> : null}{error ? <p role="alert" className="field-error">{error}</p> : null}</Card></main>
    <aside className="booking-detail-aside"><Card><span className="eyebrow">New selection</span><p>{selectedDate || 'Choose a date'}{selectedTime ? ` · ${selectedTime}` : ''}</p><Button type="button" disabled={!selectedDate || !selectedTime || busy} onClick={() => void submit()}>{busy ? 'Rescheduling…' : 'Confirm reschedule'}</Button><Link href={`/bookings/${encodeURIComponent(booking.bookingId)}`} className="button button-secondary">Keep current booking</Link></Card><p className="support-note">The new slot is revalidated before the shared booking record is updated. The old slot is released after a successful reschedule.</p></aside></div>
  </div>;
}
