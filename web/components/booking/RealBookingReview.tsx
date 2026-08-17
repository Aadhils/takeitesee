'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, Input } from '../ui/primitives';
import { displayText, type DiscoveryService } from '../../data/discovery-fixtures';
import { formatMoney } from '../../types/money';
import type { EntityId } from '../../types/entities';
import { getCurrentCustomerAsync, isSupabaseConfigured, presentationAuthAdapter } from '../../services/auth-adapter';
import { createBookingThroughConfiguredRepository, saveBookingDraft } from '../../services/booking-repository';
import { Breadcrumbs } from '../layout/NavigationContext';

export default function RealBookingReview({ service, date, dateLabel, time }: { service: DiscoveryService; date: string; dateLabel?: string; time: string }) {
  const [notes, setNotes] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!termsAccepted || submitting) return;
    setSubmitting(true);
    setError('');
    const productionMode = isSupabaseConfigured();
    const draft = {
      idempotencyKey: `booking-${service.id}-${date}-${time}`,
      customerId: 'pending-auth' as EntityId,
      serviceId: service.id,
      providerId: service.provider_id,
      providerType: service.provider_type,
      serviceName: displayText(service.service_name),
      customerName: '',
      bookingDate: date,
      startTime: time,
      timezone: 'Asia/Kolkata',
      durationMinutes: service.duration_minutes,
      location: service.location,
      customerNotes: notes.trim() || undefined,
      basePrice: service.pricing.base_price.amount,
      currency: service.pricing.base_price.currency,
    };
    const auth = await getCurrentCustomerAsync();
    if (!productionMode && !auth.authenticated) {
      saveBookingDraft(draft);
      const returnTo = `/services/${service.id}/review?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}${dateLabel ? `&dateLabel=${encodeURIComponent(dateLabel)}` : ''}`;
      window.location.assign(presentationAuthAdapter.getLoginPath(returnTo));
      return;
    }
    try {
      const booking = await createBookingThroughConfiguredRepository({ ...draft, customerId: auth.authenticated ? auth.customerId as EntityId : '00000000-0000-4000-8000-000000000000' as EntityId, customerName: auth.authenticated ? auth.customerName : '', customerContactReference: auth.authenticated ? auth.customerContactReference : undefined });
      window.location.assign(`/bookings/${booking.bookingId}/confirmation`);
    } catch (caught) {
      if (productionMode && caught instanceof Error && caught.message.toLowerCase().includes('authentication')) {
        saveBookingDraft(draft);
        window.location.assign(presentationAuthAdapter.getLoginPath(`/services/${service.id}/review?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}${dateLabel ? `&dateLabel=${encodeURIComponent(dateLabel)}` : ''}`));
        return;
      }
      const detail = caught instanceof Error ? caught.message : '';
      // Surface the real repository/Supabase error while developing so booking failures are diagnosable; keep the message generic in production builds.
      setError(process.env.NODE_ENV !== 'production' && detail ? `We could not create this booking: ${detail}` : 'We could not create this booking. Please try again.');
      setSubmitting(false);
    }
  };

  return <div className="booking-review-page"><Breadcrumbs items={[{ label: 'Booking', href: `/services/${service.id}/booking` }, { label: 'Review' }]} /><div className="review-page-heading"><span className="eyebrow">Step 4 of 4 · Review</span><h1>Review your booking</h1><p>Check the details below before continuing.</p></div><div className="review-layout"><main className="review-main"><Card className="review-section"><div className="section-heading"><div><span className="eyebrow">Service selected</span><h2>{displayText(service.service_name)}</h2></div><Link href={`/services/${service.id}/booking`} className="text-link">Edit selection</Link></div><dl className="review-details"><div><dt>Provider</dt><dd>{service.provider_name}</dd></div><div><dt>Date and time</dt><dd>{dateLabel ?? date}, {time} IST</dd></div><div><dt>Duration</dt><dd>{service.duration_minutes} minutes</dd></div><div><dt>Location</dt><dd>{service.location}</dd></div></dl></Card><Card className="review-section"><span className="eyebrow">A note for the provider</span><h2>Anything they should know?</h2><Input label="Notes or instructions" hint="Optional. Saved with your booking draft." placeholder="Add access details or context" value={notes} onChange={(event) => setNotes(event.target.value)} /></Card><Card className="review-section"><span className="eyebrow">Before you continue</span><h2>Cancellation and rescheduling</h2><p className="detail-copy">{service.policy}</p><label className="terms-row"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span>I understand the booking will remain subject to provider confirmation and payment is not collected here.</span></label></Card></main><aside className="review-aside"><Card className="review-price"><span className="eyebrow">Price summary</span><strong>{formatMoney(service.pricing.base_price)}</strong><span>{service.pricing.pricing_model === 'hourly' ? 'Hourly starting price' : 'Starting price'}</span></Card><Button type="button" disabled={!termsAccepted || submitting} loading={submitting} onClick={handleConfirm}>Confirm booking</Button>{error ? <p className="field-error" role="alert">{error}</p> : null}<p className="explore-disclaimer">You will be asked to sign in before the booking can be created. No payment is collected here.</p></aside></div></div>;
}
