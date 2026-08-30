'use client';

import Link from 'next/link';
import { Badge, Card } from '../ui/primitives';
import { Breadcrumbs } from '../layout/NavigationContext';

type Review = { id: string; reviewer_name: string; rating: number; comment: string; date: string; verified_booking: boolean };
type LiveService = {
  id: string;
  name: string;
  description: string;
  category: string;
  provider_name: string;
  provider_type: 'professional' | 'business';
  provider_id: string;
  provider_description: string;
  location: string;
  service_area: string;
  duration_minutes: number;
  base_price: number;
  currency: string;
  verified: boolean;
  rating: number;
  review_count: number;
};

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

function Stars({ rating, count }: { rating: number; count: number }) {
  return <span className="rating" aria-label={`${rating.toFixed(1)} out of 5 from ${count} reviews`}><span aria-hidden="true">★</span> {rating.toFixed(1)} <small>({count})</small></span>;
}

export default function LiveServiceDetail({ service, reviews, exploreHref = '/explore' }: { service: LiveService; reviews: Review[]; exploreHref?: string }) {
  const providerHref = service.provider_type === 'professional' ? `/professionals/${service.provider_id}` : `/businesses/${service.provider_id}`;
  const bookingHref = `/services/${service.id}/booking`;
  const counts = [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((review) => Math.round(review.rating) === star).length }));

  return <div className="detail-page">
    <Breadcrumbs items={[{ label: 'Explore', href: exploreHref }, { label: 'Service' }]} />
    <section className="detail-hero"><div><div className="card-meta"><Badge tone="info">{service.category || 'Service'}</Badge><Badge tone="success">Live listing</Badge></div><h1>{service.name}</h1><p className="detail-lede">{service.description}</p><div className="detail-meta"><span>{service.location || service.service_area}</span><span>{service.duration_minutes} minutes</span><Stars rating={service.rating} count={service.review_count} /></div></div><div className="price-summary"><span className="eyebrow">Starting price</span><strong>{money(service.base_price, service.currency)}</strong><span>per service · {service.duration_minutes} minutes</span></div></section>

    <div className="detail-layout"><main>
      <Card className="provider-summary"><div className="provider-avatar provider-avatar-large" aria-hidden="true">{service.provider_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><div className="detail-badges"><Badge tone={service.verified ? 'success' : 'neutral'}>{service.verified ? 'Verified profile' : 'Provider profile'}</Badge><Badge tone="info">{service.provider_type === 'business' ? 'Business provider' : 'Professional provider'}</Badge></div><h2>{service.provider_name}</h2><p className="provider-headline">{service.provider_description || (service.provider_type === 'business' ? 'Local business provider' : 'Professional provider')}</p><p className="card-location">{service.service_area || service.location}</p><Stars rating={service.rating} count={service.review_count} /></div><Link className="text-link" href={providerHref}>View profile</Link></Card>

      <section className="detail-section"><span className="eyebrow">About the service</span><h2>Service details</h2><p className="detail-copy">{service.description || 'The provider will confirm the final scope and timing before the booking is accepted.'}</p></section>

      <section className="detail-section"><span className="eyebrow">Policies</span><h2>Cancellation and rescheduling</h2><p className="detail-copy">Cancellation and rescheduling terms will be shown during booking before you confirm your request.</p></section>

      <section className="detail-section" aria-labelledby="reviews-heading"><div className="section-heading"><div><span className="eyebrow">Customer voice</span><h2 id="reviews-heading">Reviews</h2></div><Stars rating={service.rating} count={service.review_count} /></div>{reviews.length ? <><div className="review-summary"><strong>{service.rating.toFixed(1)} <span aria-hidden="true">★</span></strong><div className="rating-bars">{counts.map(({ star, count }) => { const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0; return <span key={star}><i style={{ width: `${pct}%` }} />{star} <small>{pct}%</small></span>; })}</div></div><div className="review-list">{reviews.map((review) => <Card className="review-card" key={review.id}><div className="review-card-top"><strong>{review.reviewer_name}</strong><span>{review.date}</span></div><Stars rating={review.rating} count={0} />{review.verified_booking ? <Badge tone="success">Completed booking</Badge> : null}{review.comment ? <p>{review.comment}</p> : null}</Card>)}</div></> : <p className="empty-inline">No published customer reviews yet.</p>}</section>
    </main>

    <aside className="detail-aside"><Card className="booking-summary"><div className="section-heading"><div><span className="eyebrow">Booking</span><h2>Booking summary</h2></div><Badge tone="success">Live service</Badge></div><dl><div><dt>Service</dt><dd>{service.name}</dd></div><div><dt>Provider</dt><dd>{service.provider_name}</dd></div><div><dt>Estimated price</dt><dd>{money(service.base_price, service.currency)}</dd></div></dl></Card><Link href={bookingHref} className="button button-primary detail-cta">Choose a date and time</Link></aside>
    </div>
    <div className="mobile-sticky-cta"><Link href={bookingHref} className="button button-primary">Choose a date and time</Link></div>
  </div>;
}
