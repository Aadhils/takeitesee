'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { getBookingThroughConfiguredRepository } from '../../services/booking-repository';
import type { CustomerBooking } from '../../types/booking-domain';
import { formatMoney } from '../../types/money';

export default function CustomerBookingConfirmation({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<CustomerBooking>();
  useEffect(() => { void getBookingThroughConfiguredRepository(bookingId as CustomerBooking['bookingId']).then(setBooking).catch(() => setBooking(undefined)); }, [bookingId]);
  if (!booking) return <EmptyState title="Booking not found">This booking is unavailable in the current browser session.</EmptyState>;
  return <div className="confirmation-page"><section className="confirmation-panel" aria-labelledby="confirmation-heading" role="status"><span className="confirmation-mark" aria-hidden="true">✓</span><span className="eyebrow">Booking confirmation</span><h1 id="confirmation-heading">Booking confirmed</h1><p>Your request has been saved and is awaiting provider confirmation.</p><div className="confirmation-reference"><span>Booking reference</span><strong>{booking.bookingReference}</strong></div></section><div className="confirmation-layout"><Card><div className="booking-card-top"><div><span className="eyebrow">Service</span><h2>{booking.serviceName}</h2></div><Badge tone="warning">{booking.status}</Badge></div><p className="card-provider">{booking.providerName}</p><dl className="review-details"><div><dt>Date and time</dt><dd>{booking.bookingDate}, {booking.startTime} {booking.timezone}</dd></div><div><dt>Duration</dt><dd>{booking.durationMinutes} minutes</dd></div><div><dt>Location</dt><dd>{booking.location}</dd></div><div><dt>Price</dt><dd>{formatMoney({ amount: booking.basePrice, currency: booking.currency })}</dd></div><div><dt>Notes or instructions</dt><dd>{booking.customerNotes || 'No notes provided'}</dd></div></dl><div className="payment-line"><span>Payment status</span><Badge tone="neutral">{booking.paymentStatus}</Badge></div><p className="summary-note">Payment has not been collected.</p></Card><div className="confirmation-actions"><Link href={`/bookings/${booking.bookingId}`} className="button button-primary">View booking</Link><Link href="/bookings" className="button button-secondary">My bookings</Link><Link href="/explore" className="button button-secondary">Explore more services</Link></div></div></div>;
}
