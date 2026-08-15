'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
import { Rating } from '../discovery/MarketplaceCards';
import { Breadcrumbs } from '../layout/NavigationContext';
import { categoryName, displayText, discoveryAvailability, type DiscoveryAvailability, type DiscoveryProfessional, type DiscoveryReview, type DiscoveryService } from '../../data/discovery-fixtures';
import { formatMoney } from '../../types/money';

export function TrustBadges({ verified, providerType }: { verified: boolean; providerType?: 'professional' | 'business' }) {
  return <div className="detail-badges" aria-label="Trust information"><Badge tone={verified ? 'success' : 'neutral'}>{verified ? 'Verified profile' : 'Independent profile'}</Badge>{providerType ? <Badge tone="info">{providerType === 'business' ? 'Business provider' : 'Professional provider'}</Badge> : null}<span className="detail-disclaimer">Presentation data</span></div>;
}

export function PriceSummary({ service }: { service: DiscoveryService }) {
  const model = service.pricing.pricing_model === 'hourly' ? 'per hour' : service.pricing.pricing_model === 'negotiable' ? 'starting quote' : 'per service';
  return <div className="price-summary"><span className="eyebrow">Starting price</span><strong>{formatMoney(service.pricing.base_price)}</strong><span>{model} · {service.duration_minutes} minutes</span></div>;
}

export function ProviderSummary({ provider, providerType = 'professional', profileHref = `/professionals/${provider.id}` }: { provider: DiscoveryProfessional; providerType?: 'professional' | 'business'; profileHref?: string }) {
  return <Card className="provider-summary"><div className="provider-avatar provider-avatar-large" aria-hidden="true">{provider.display_name.split(' ').map((part) => part[0]).join('')}</div><div><TrustBadges verified={provider.verified} providerType={providerType} /><h2>{provider.display_name}</h2><p className="provider-headline">{provider.headline}</p><p className="card-location">{provider.location}</p><Rating value={provider.rating} count={provider.review_count} /></div><Link className="text-link" href={profileHref}>View profile</Link></Card>;
}

export function ReviewSummary({ rating, count, reviews }: { rating: number; count: number; reviews: DiscoveryReview[] }) {
  return <section className="detail-section" aria-labelledby="reviews-heading"><div className="section-heading"><div><span className="eyebrow">Customer voice</span><h2 id="reviews-heading">Reviews</h2></div><Rating value={rating} count={count} /></div><div className="review-summary"><strong>{rating.toFixed(1)} <span aria-hidden="true">★</span></strong><div className="rating-bars" aria-label="Rating distribution"><span><i style={{ width: '86%' }} />5 <small>86%</small></span><span><i style={{ width: '10%' }} />4 <small>10%</small></span><span><i style={{ width: '4%' }} />3 or below <small>4%</small></span></div></div>{reviews.length ? <div className="review-list">{reviews.map((review) => <ReviewCard review={review} key={review.id} />)}</div> : <p className="empty-inline">No written reviews are included in this presentation fixture yet.</p>}</section>;
}

export function ReviewCard({ review }: { review: DiscoveryReview }) {
  return <Card className="review-card"><div className="review-card-top"><strong>{review.reviewer_name}</strong><span>{review.date}</span></div><Rating value={review.rating} count={0} />{review.verified_booking ? <Badge tone="success">Completed booking</Badge> : null}<p>{review.comment}</p></Card>;
}

export function ServiceHero({ service }: { service: DiscoveryService }) {
  return <section className="detail-hero"><div><div className="card-meta"><Badge tone="info">{categoryName(service.category_id)}</Badge><Badge tone={service.availability === 'Remote delivery' ? 'info' : 'success'}>{service.availability}</Badge></div><h1>{displayText(service.service_name)}</h1><p className="detail-lede">{displayText(service.description)}</p><div className="detail-meta"><span>{service.location}</span><span>{service.duration_minutes} minutes</span><Rating value={service.rating} count={service.review_count} /></div></div><PriceSummary service={service} /></section>;
}

export function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = ['Service', 'Provider', 'Date & time', 'Summary'];
  return <nav className="step-indicator" aria-label="Booking selection progress"><ol>{steps.map((step, index) => <li className={index <= currentStep ? 'step-active' : ''} key={step} aria-current={index === currentStep ? 'step' : undefined}><span>{index + 1}</span>{step}</li>)}</ol></nav>;
}

export function DateSelector({ availability, selectedDate, onSelect }: { availability: DiscoveryAvailability[]; selectedDate: string; onSelect: (date: string) => void }) {
  return <fieldset className="selector-group"><legend>Select a date</legend><div className="date-options">{availability.map((day) => <button className={`date-option ${day.date === selectedDate ? 'date-selected' : ''}`} type="button" aria-pressed={day.date === selectedDate} onClick={() => onSelect(day.date)} key={day.date}><strong>{day.label.split(',')[0]}</strong><span>{day.label.substring(5)}</span><small>{day.slots.filter((slot) => slot.available).length} times</small></button>)}</div></fieldset>;
}

export function TimeSlotSelector({ day, selectedTime, onSelect }: { day: DiscoveryAvailability; selectedTime: string; onSelect: (time: string) => void }) {
  return <fieldset className="selector-group"><legend>Select a time</legend><div className="time-options">{day.slots.map((slot) => <button className="time-option" type="button" disabled={!slot.available} aria-pressed={slot.time === selectedTime} onClick={() => onSelect(slot.time)} key={slot.time}>{slot.time}{!slot.available ? <span>Unavailable</span> : null}</button>)}</div></fieldset>;
}

export function BookingSummaryCard({ service, date, time }: { service: DiscoveryService; date?: DiscoveryAvailability; time: string }) {
  return <Card className="booking-summary"><div className="section-heading"><div><span className="eyebrow">Your selection</span><h2>Booking summary</h2></div><Badge tone="warning">Preview only</Badge></div><dl><div><dt>Service</dt><dd>{displayText(service.service_name)}</dd></div><div><dt>Provider</dt><dd>{service.provider_name}</dd></div><div><dt>When</dt><dd>{date ? `${date.label}, ${time}` : 'Choose a date and time'}</dd></div><div><dt>Estimated price</dt><dd>{formatMoney(service.pricing.base_price)}</dd></div></dl><p className="summary-note">This selection is local fixture state. No booking, account, payment, or calendar request is created.</p></Card>;
}

export function BookingSelection({ service }: { service: DiscoveryService }) {
  const [selectedDate, setSelectedDate] = useState(discoveryAvailability[0].date);
  const [selectedTime, setSelectedTime] = useState('');
  const day = discoveryAvailability.find((item) => item.date === selectedDate) ?? discoveryAvailability[0];
  const reviewHref = `/services/${service.id}/review?date=${encodeURIComponent(day.label)}&time=${encodeURIComponent(selectedTime)}`;
  return <section className="booking-flow" aria-labelledby="booking-heading"><Breadcrumbs items={[{ label: 'Explore', href: '/explore' }, { label: 'Service', href: `/services/${service.id}` }, { label: 'Book' }]} /><StepIndicator currentStep={2} /><div className="booking-flow-header"><span className="eyebrow">Presentation booking flow</span><h1 id="booking-heading">Choose a time that works</h1><p>Review the service and provider, then select from illustrative local availability.</p></div><div className="booking-layout"><div className="booking-controls"><Card><DateSelector availability={discoveryAvailability} selectedDate={selectedDate} onSelect={(date) => { setSelectedDate(date); setSelectedTime(''); }} /><TimeSlotSelector day={day} selectedTime={selectedTime} onSelect={setSelectedTime} /></Card>{selectedTime ? <Link className="button button-primary" href={reviewHref}>Continue to review</Link> : <Button type="button" disabled>Continue to review</Button>}<p className="explore-disclaimer">The continue control demonstrates the next step only. It does not submit or persist anything.</p></div><BookingSummaryCard service={service} date={selectedTime ? day : undefined} time={selectedTime} /></div></section>;
}

export function ServiceDetail({ service }: { service: DiscoveryService }) {
  const provider = { id: service.provider_id, display_name: service.provider_name, headline: `${service.provider_type === 'business' ? 'Trusted local business' : 'Independent professional'}`, specialty: categoryName(service.category_id), location: service.location, rating: service.rating, review_count: service.review_count, verified: service.verified, availability_mode: 'full_time' as const, status: 'active' as const, summary: '', experience_years: 0, service_area: service.service_area, services: [displayText(service.service_name)], availability_summary: service.availability, reviews: [] };
  return <div className="detail-page"><Breadcrumbs items={[{ label: 'Explore', href: '/explore' }, { label: 'Service' }]} /><ServiceHero service={service} /><div className="detail-layout"><main><ProviderSummary provider={provider} providerType={service.provider_type} profileHref={service.provider_type === 'professional' ? `/professionals/${service.provider_id}` : '/businesses'} /><section className="detail-section"><span className="eyebrow">About the service</span><h2>What to expect</h2><p className="detail-copy">{service.long_description}</p><div className="detail-columns"><div><h3>Highlights</h3><ul className="detail-list">{service.highlights.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>Included</h3><ul className="detail-list">{service.inclusions.map((item) => <li key={item}>{item}</li>)}</ul></div></div></section><section className="detail-section"><span className="eyebrow">Policies</span><h2>Cancellation and rescheduling</h2><p className="detail-copy">{service.policy}</p></section><ReviewSummary rating={service.rating} count={service.review_count} reviews={[]} /></main><aside className="detail-aside"><BookingSummaryCard service={service} time="" /><Link href={`/services/${service.id}/booking`} className="button button-primary detail-cta">Choose a date and time</Link></aside></div><div className="mobile-sticky-cta"><Link href={`/services/${service.id}/booking`} className="button button-primary">Choose a date and time</Link></div></div>;
}

export { discoveryAvailability };
