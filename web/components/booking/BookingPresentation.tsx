'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, EmptyState, Input } from '../ui/primitives';
import { displayText, discoveryBookings, discoveryServices, type DiscoveryBooking, type DiscoveryService } from '../../data/discovery-fixtures';
import type { BookingStatus } from '../../types/booking';
import type { PaymentStatus } from '../../types/payment';
import { formatMoney } from '../../types/money';
import { Breadcrumbs } from '../layout/NavigationContext';
import RealBookingReview from './RealBookingReview';
import type { CatalogService } from '../../services/catalog-repository';

const bookingStatusLabels: Record<BookingStatus, string> = {
  draft: 'Draft', requested: 'Requested', provider_review: 'Provider review', rejected: 'Rejected', accepted: 'Accepted', reschedule_requested: 'Reschedule requested', scheduled: 'Scheduled', in_progress: 'In progress', completion_pending: 'Completion pending', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show', refund_pending: 'Refund pending', closed: 'Closed',
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: 'Payment pending', initiated: 'Payment initiated', authorized: 'Payment authorized', captured: 'Paid', failed: 'Payment failed', cancelled: 'Payment cancelled', partially_refunded: 'Partially refunded', refunded: 'Refunded', disputed: 'Payment disputed', settled: 'Settled', closed: 'Payment closed',
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const tone = status === 'completed' || status === 'scheduled' || status === 'accepted' ? 'success' : status === 'cancelled' || status === 'rejected' || status === 'no_show' ? 'danger' : status === 'provider_review' || status === 'reschedule_requested' ? 'warning' : 'info';
  return <Badge tone={tone}>{bookingStatusLabels[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone = status === 'captured' || status === 'authorized' || status === 'settled' ? 'success' : status === 'failed' || status === 'cancelled' ? 'danger' : status === 'refunded' || status === 'partially_refunded' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{paymentStatusLabels[status]}</Badge>;
}

export function BookingTimeline({ booking }: { booking: DiscoveryBooking }) {
  return <section className="booking-timeline" aria-labelledby="timeline-heading"><h2 id="timeline-heading">Booking timeline</h2><ol>{booking.timeline.map((item) => <li className={item.complete ? 'timeline-complete' : ''} key={`${item.status}-${item.label}`}><span className="timeline-marker" aria-hidden="true">{item.complete ? '✓' : '○'}</span><div><strong>{item.label}</strong><span>{item.detail}</span></div></li>)}</ol><p className="sr-only">Timeline status is presentation data and is not connected to a live booking.</p></section>;
}

function serviceForBooking(booking: DiscoveryBooking) {
  return discoveryServices.find((service) => service.id === booking.service_id);
}

export function BookingCard({ booking }: { booking: DiscoveryBooking }) {
  const service = serviceForBooking(booking);
  return <Card className="booking-card"><div className="booking-card-top"><div><span className="eyebrow">{booking.booking_reference}</span><h3>{service ? displayText(service.service_name) : 'Service booking'}</h3></div><BookingStatusBadge status={booking.status} /></div><p className="card-provider">{booking.provider_name} <span aria-hidden="true">·</span> {booking.provider_type === 'business' ? 'Business' : 'Professional'}</p><div className="booking-card-meta"><span>{booking.date_label}, {booking.time}</span><span>{formatMoney(booking.price)}</span><PaymentStatusBadge status={booking.payment_status} /></div><Link href={`/bookings/${booking.id}`} className="button button-secondary">View booking details</Link></Card>;
}

export function BookingReview({ service, date, dateLabel, time }: { service: CatalogService; date: string; dateLabel?: string; time: string }) {
  return <RealBookingReview service={service} date={date} dateLabel={dateLabel} time={time} />;
  /*
  const [notes, setNotes] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const reviewHref = `/confirmation/demo-${service.id}?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&notes=${encodeURIComponent(notes)}`;
  return <div className="booking-review-page"><Breadcrumbs items={[{ label: 'Booking', href: `/services/${service.id}/booking` }, { label: 'Review' }]} /><div className="review-page-heading"><span className="eyebrow">Step 4 of 4 · Presentation flow</span><h1>Review your booking</h1><p>Check the details below before continuing to the fixture confirmation page.</p></div><div className="review-layout"><main className="review-main"><Card className="review-section"><div className="section-heading"><div><span className="eyebrow">Service selected</span><h2>{displayText(service.service_name)}</h2></div><Link href={`/services/${service.id}/booking`} className="text-link">Edit selection</Link></div><dl className="review-details"><div><dt>Provider</dt><dd>{service.provider_name}</dd></div><div><dt>Date and time</dt><dd>{date}, {time} IST</dd></div><div><dt>Duration</dt><dd>{service.duration_minutes} minutes</dd></div><div><dt>Location</dt><dd>{service.location}</dd></div></dl></Card><Card className="review-section"><span className="eyebrow">A note for the provider</span><h2>Anything they should know?</h2><Input label="Notes or instructions" hint="Optional. This remains local presentation state." placeholder="Add access details or context" value={notes} onChange={(event) => setNotes(event.target.value)} /></Card><Card className="review-section"><span className="eyebrow">Before you continue</span><h2>Cancellation and rescheduling</h2><p className="detail-copy">{service.policy}</p><label className="terms-row"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span>I understand this is a presentation-only booking flow and no real booking will be created.</span></label></Card></main><aside className="review-aside"><Card className="review-price"><span className="eyebrow">Price summary</span><strong>{formatMoney(service.pricing.base_price)}</strong><span>{service.pricing.pricing_model === 'hourly' ? 'Hourly starting price' : 'Illustrative service price'}</span><hr /><div><span>Service total</span><strong>{formatMoney(service.pricing.base_price)}</strong></div><p>Taxes and fees are not shown because they are not part of the current presentation model.</p></Card><Button type="button" disabled={!termsAccepted} onClick={() => { window.location.href = reviewHref; }}>Confirm booking</Button><p className="explore-disclaimer">Confirmation opens a fixture page only. No API, payment, or persistence is involved.</p></aside></div></div>;
  */
}

export function ConfirmationPanel({ booking, service }: { booking: DiscoveryBooking; service: DiscoveryService }) {
  return <div className="confirmation-page"><section className="confirmation-panel" aria-labelledby="confirmation-heading" role="status"><span className="confirmation-mark" aria-hidden="true">✓</span><span className="eyebrow">Presentation confirmation</span><h1 id="confirmation-heading">Your selection is ready</h1><p>This fixture confirmation demonstrates the next customer step. It is not a live booking.</p><div className="confirmation-reference"><span>Fixture reference</span><strong>{booking.booking_reference}</strong></div></section><div className="confirmation-layout"><Card><div className="booking-card-top"><div><span className="eyebrow">Service</span><h2>{displayText(service.service_name)}</h2></div><BookingStatusBadge status={booking.status} /></div><p className="card-provider">{booking.provider_name}</p><dl className="review-details"><div><dt>Date and time</dt><dd>{booking.date_label}, {booking.time} IST</dd></div><div><dt>Duration</dt><dd>{booking.duration_minutes} minutes</dd></div><div><dt>Price</dt><dd>{formatMoney(booking.price)}</dd></div></dl><div className="payment-line"><span>Payment status</span><PaymentStatusBadge status={booking.payment_status} /></div><p className="summary-note">Payment is not implemented in this presentation phase. No charge has been made.</p></Card><div className="confirmation-actions"><Link href={`/bookings/${booking.id}?date=${encodeURIComponent(booking.date_label)}&time=${encodeURIComponent(booking.time)}`} className="button button-primary">View fixture booking</Link><Link href="/explore" className="button button-secondary">Return to discovery</Link></div></div></div>;
}

export function BookingsPage() {
  const groups: { title: string; statuses: BookingStatus[] }[] = [{ title: 'Upcoming', statuses: ['scheduled', 'accepted'] }, { title: 'Needs attention', statuses: ['provider_review', 'requested'] }, { title: 'Completed', statuses: ['completed'] }, { title: 'Cancelled', statuses: ['cancelled', 'rejected'] }];
  return <div className="bookings-page"><section className="page-intro"><span className="eyebrow">Customer space</span><h1>My bookings</h1><p>Review fixture booking states and see how the customer journey will look once connected to live data.</p></section>{groups.map((group) => { const bookings = discoveryBookings.filter((booking) => group.statuses.includes(booking.status)); return <section className="booking-group" aria-labelledby={`group-${group.title}`} key={group.title}><div className="section-heading"><h2 id={`group-${group.title}`}>{group.title}</h2><span className="results-note">{bookings.length} shown</span></div>{bookings.length ? <div className="booking-grid">{bookings.map((booking) => <BookingCard booking={booking} key={booking.id} />)}</div> : <Card><EmptyState title={`No ${group.title.toLowerCase()} bookings`}>Bookings in this state will appear here when customer booking data is connected.</EmptyState></Card>}</section>; })}<p className="explore-disclaimer">All bookings on this page are local presentation fixtures. They do not represent account history.</p></div>;
}

export function BookingDetail({ booking }: { booking: DiscoveryBooking }) {
  const service = serviceForBooking(booking);
  if (!service) return <Card><EmptyState title="Service unavailable">This fixture no longer has a matching service.</EmptyState></Card>;
  return <div className="booking-detail-page"><section className="booking-detail-heading"><div><span className="eyebrow">{booking.booking_reference}</span><h1>{displayText(service.service_name)}</h1><p>{booking.provider_name} · {booking.date_label}, {booking.time} IST</p></div><BookingStatusBadge status={booking.status} /></section><div className="booking-detail-layout"><main><Card className="detail-status-card"><div className="section-heading"><div><span className="eyebrow">Current booking status</span><h2>{bookingStatusLabels[booking.status]}</h2></div><PaymentStatusBadge status={booking.payment_status} /></div><p className="detail-copy">This status is sourced from a local fixture and does not represent a server booking.</p></Card><BookingTimeline booking={booking} /><Card className="policy-card"><span className="eyebrow">Policy</span><h2>Cancellation and rescheduling</h2><p>{service.policy}</p></Card></main><aside className="booking-detail-aside"><Card><span className="eyebrow">Booking summary</span><dl className="review-details"><div><dt>Provider</dt><dd>{booking.provider_name}</dd></div><div><dt>Date and time</dt><dd>{booking.date_label}, {booking.time}</dd></div><div><dt>Duration</dt><dd>{booking.duration_minutes} minutes</dd></div><div><dt>Location</dt><dd>{booking.location}</dd></div><div><dt>Total</dt><dd>{formatMoney(booking.price)}</dd></div></dl>{booking.review_eligible ? <Link href={`/bookings/${booking.id}/review`} className="button button-primary">Leave a review</Link> : null}<Link href="/explore" className="button button-secondary">Find another service</Link></Card><p className="support-note">Need help? Support actions will be connected in a later phase.</p></aside></div></div>;
}

export { discoveryBookings };
