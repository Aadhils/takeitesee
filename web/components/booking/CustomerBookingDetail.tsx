'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { cancelBookingThroughConfiguredRepository, getBookingThroughConfiguredRepository } from '../../services/booking-repository';
import type { CustomerBooking } from '../../types/booking-domain';
import { discoveryServices, displayText } from '../../data/discovery-fixtures';
import { formatMoney } from '../../types/money';

export default function CustomerBookingDetail({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<CustomerBooking>();
  useEffect(() => { void getBookingThroughConfiguredRepository(bookingId as CustomerBooking['bookingId']).then(setBooking).catch(() => setBooking(undefined)); }, [bookingId]);
  if (!booking) return <EmptyState title="Booking not found">This booking is unavailable or does not belong to the current browser session.</EmptyState>;
  const service = discoveryServices.find((item) => item.id === booking.serviceId);
  const canCancel = !['completed', 'cancelled'].includes(booking.status);
  const handleCancel = async () => { try { setBooking(await cancelBookingThroughConfiguredRepository(booking.bookingId)); } catch { /* The current state remains visible on failure. */ } };
  return <div className="booking-detail-page"><section className="booking-detail-heading"><div><span className="eyebrow">{booking.bookingReference}</span><h1>{service ? displayText(service.service_name) : booking.serviceName}</h1><p>{booking.bookingDate} · {booking.startTime} {booking.timezone}</p></div><Badge tone={booking.status === 'cancelled' ? 'danger' : booking.status === 'completed' ? 'success' : 'info'}>{booking.status}</Badge></section><div className="booking-detail-layout"><main><Card className="detail-status-card"><div className="section-heading"><div><span className="eyebrow">Current booking status</span><h2>{booking.status}</h2></div><Badge tone="neutral">Payment {booking.paymentStatus}</Badge></div><p className="detail-copy">This booking is managed by the configured TakeItSee backend.</p></Card><Card className="policy-card"><span className="eyebrow">Booking information</span><dl className="review-details"><div><dt>Provider</dt><dd>{booking.providerType === 'business' ? 'Business' : 'Professional'} · {booking.providerId}</dd></div><div><dt>Date and time</dt><dd>{booking.bookingDate}, {booking.startTime} {booking.timezone}</dd></div><div><dt>Duration</dt><dd>{booking.durationMinutes} minutes</dd></div><div><dt>Location</dt><dd>{booking.location}</dd></div><div><dt>Price</dt><dd>{formatMoney({ amount: booking.basePrice, currency: booking.currency })}</dd></div></dl></Card></main><aside className="booking-detail-aside"><Card><span className="eyebrow">Actions</span>{canCancel ? <button type="button" className="button button-secondary" onClick={handleCancel}>Cancel booking</button> : null}<Link href="/explore" className="button button-secondary">Find another service</Link></Card><p className="support-note">Rescheduling and provider contact will be enabled when server capabilities are connected.</p></aside></div></div>;
}
