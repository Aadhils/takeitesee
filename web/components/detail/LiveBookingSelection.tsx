'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
import { Breadcrumbs } from '../layout/NavigationContext';
import { displayText, type DiscoveryService } from '../../data/discovery-fixtures';
import { formatMoney } from '../../types/money';
import { StepIndicator } from './DetailPresentation';

type Slot = { time: string; value?: string; available: boolean; reason?: string };
type AvailabilityDay = { date: string; label: string; slots: Slot[] };
type AvailabilityResponse = { mode: string; timezone: string; duration_minutes: number; days: AvailabilityDay[]; error?: string };

function DateSelector({ availability, selectedDate, onSelect }: { availability: AvailabilityDay[]; selectedDate: string; onSelect: (date: string) => void }) {
  return <fieldset className="selector-group"><legend>Select a date</legend><div className="date-options">{availability.map((day) => {
    const availableCount = day.slots.filter((slot) => slot.available).length;
    return <button className={`date-option ${day.date === selectedDate ? 'date-selected' : ''}`} type="button" disabled={!availableCount} aria-pressed={day.date === selectedDate} onClick={() => onSelect(day.date)} key={day.date}><strong>{day.label.split(',')[0]}</strong><span>{day.label.split(',').slice(1).join(',').trim()}</span><small>{availableCount ? `${availableCount} times` : 'Unavailable'}</small></button>;
  })}</div></fieldset>;
}

function TimeSlotSelector({ day, selectedTime, onSelect }: { day: AvailabilityDay; selectedTime: string; onSelect: (time: string) => void }) {
  return <fieldset className="selector-group"><legend>Select a time</legend><div className="time-options">{day.slots.map((slot) => <button className="time-option" type="button" disabled={!slot.available} aria-pressed={slot.time === selectedTime} onClick={() => onSelect(slot.time)} key={`${day.date}-${slot.time}`}>{slot.time}{!slot.available ? <span>{slot.reason ?? 'Unavailable'}</span> : null}</button>)}</div></fieldset>;
}

function BookingSummary({ service, day, time }: { service: DiscoveryService; day?: AvailabilityDay; time: string }) {
  return <Card className="booking-summary"><div className="section-heading"><div><span className="eyebrow">Your selection</span><h2>Booking summary</h2></div><Badge tone="success">Live availability</Badge></div><dl><div><dt>Service</dt><dd>{displayText(service.service_name)}</dd></div><div><dt>Provider</dt><dd>{service.provider_name}</dd></div><div><dt>When</dt><dd>{day && time ? `${day.label}, ${time}` : 'Choose a date and time'}</dd></div><div><dt>Estimated price</dt><dd>{formatMoney(service.pricing.base_price)}</dd></div></dl><p className="summary-note">Times are generated from the provider schedule and blocked periods. Final availability is checked again when you confirm.</p></Card>;
}

export default function LiveBookingSelection({ service }: { service: DiscoveryService }) {
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const routeSearchParams = useSearchParams();
  const contextQuery = routeSearchParams.toString();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/services/${service.id}/availability`, { cache: 'no-store' });
        const body = await response.json() as AvailabilityResponse;
        if (!response.ok) throw new Error(body.error || 'Unable to load provider availability.');
        if (cancelled) return;
        setAvailability(body.days ?? []);
        const firstAvailable = (body.days ?? []).find((day) => day.slots.some((slot) => slot.available));
        setSelectedDate(firstAvailable?.date ?? body.days?.[0]?.date ?? '');
        setError('');
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load provider availability.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [service.id]);

  const day = useMemo(() => availability.find((item) => item.date === selectedDate), [availability, selectedDate]);
  const reviewHref = day && selectedTime ? `/services/${service.id}/review?date=${encodeURIComponent(day.date)}&dateLabel=${encodeURIComponent(day.label)}&time=${encodeURIComponent(selectedTime)}` : '#';
  const exploreHref = contextQuery ? `/explore?${contextQuery}` : '/explore';
  const serviceHref = contextQuery ? `/services/${service.id}?${contextQuery}` : `/services/${service.id}`;

  return <section className="booking-flow" aria-labelledby="booking-heading">
    <Breadcrumbs items={[{ label: 'Explore', href: exploreHref }, { label: 'Service', href: serviceHref }, { label: 'Book' }]} />
    <StepIndicator currentStep={2} />
    <div className="booking-flow-header"><span className="eyebrow">Live booking availability</span><h1 id="booking-heading">Choose a time that works</h1><p>Select from the provider's current availability. Blackouts and existing booking conflicts are unavailable.</p></div>
    <div className="booking-layout"><div className="booking-controls"><Card>
      {loading ? <p className="detail-copy">Loading provider availability…</p> : error ? <div><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => window.location.reload()}>Try again</Button></div> : availability.length && day ? <><DateSelector availability={availability} selectedDate={selectedDate} onSelect={(date) => { setSelectedDate(date); setSelectedTime(''); }} /><TimeSlotSelector day={day} selectedTime={selectedTime} onSelect={setSelectedTime} /></> : <p className="detail-copy">No bookable dates are currently available for this service.</p>}
    </Card>
    {day && selectedTime ? <Link className="button button-primary" href={reviewHref}>Continue to review</Link> : <Button type="button" disabled>Continue to review</Button>}
    <p className="explore-disclaimer">Availability is revalidated when the booking is confirmed, so a slot cannot be double-booked.</p></div><BookingSummary service={service} day={selectedTime ? day : undefined} time={selectedTime} /></div>
  </section>;
}
