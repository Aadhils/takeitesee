'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Badge, Card } from '../ui/primitives';

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

function Stars({ rating, count }: { rating: number; count: number }) {
  const { locale } = useLanguage();
  const label = locale === 'ta-IN'
    ? `5-ல் ${rating.toFixed(1)}; ${count} மதிப்புரைகள்`
    : `${rating.toFixed(1)} out of 5 from ${count} reviews`;
  return <span className="rating" aria-label={label}><span aria-hidden="true">★</span> {rating.toFixed(1)} <small>({count})</small></span>;
}

function ServiceBreadcrumbs({ exploreHref, text }: { exploreHref: string; text: (en: string, ta: string) => string }) {
  return (
    <nav className="breadcrumbs" aria-label={text('Breadcrumb', 'வழிசெலுத்தல்')}>
      <ol>
        <li><Link href={exploreHref}>{text('Explore', 'Explore')}</Link><span className="breadcrumb-separator" aria-hidden="true">/</span></li>
        <li><span aria-current="page">{text('Service', 'சேவை')}</span></li>
      </ol>
    </nav>
  );
}

export default function LiveServiceDetail({ service, reviews, exploreHref = '/explore' }: { service: LiveService; reviews: Review[]; exploreHref?: string }) {
  const { locale } = useLanguage();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
  const providerHref = service.provider_type === 'professional' ? `/professionals/${service.provider_id}` : `/businesses/${service.provider_id}`;
  const bookingHref = `/services/${service.id}/booking`;
  const counts = [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((review) => Math.round(review.rating) === star).length }));
  const providerName = service.provider_name || text('Verified provider', 'சரிபார்க்கப்பட்ட வழங்குநர்');
  const serviceCategory = service.category || text('Service', 'சேவை');
  const duration = `${service.duration_minutes} ${text('minutes', 'நிமிடங்கள்')}`;
  const money = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };
  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
    } catch {
      return value;
    }
  };

  return <div className="detail-page">
    <ServiceBreadcrumbs exploreHref={exploreHref} text={text} />
    <section className="detail-hero">
      <div>
        <div className="card-meta"><Badge tone="info">{serviceCategory}</Badge><Badge tone="success">{text('Live listing', 'Live listing')}</Badge></div>
        <h1>{service.name}</h1>
        <p className="detail-lede">{service.description}</p>
        <div className="detail-meta"><span>{service.location || service.service_area}</span><span>{duration}</span><Stars rating={service.rating} count={service.review_count} /></div>
      </div>
      <div className="price-summary"><span className="eyebrow">{text('Starting price', 'தொடக்க விலை')}</span><strong>{money(service.base_price, service.currency)}</strong><span>{text(`per service · ${duration}`, `ஒரு சேவைக்கு · ${duration}`)}</span></div>
    </section>

    <div className="detail-layout"><main>
      <Card className="provider-summary">
        <div className="provider-avatar provider-avatar-large" aria-hidden="true">{providerName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
        <div>
          <div className="detail-badges">
            <Badge tone={service.verified ? 'success' : 'neutral'}>{service.verified ? text('Verified profile', 'சரிபார்க்கப்பட்ட profile') : text('Provider profile', 'வழங்குநர் profile')}</Badge>
            <Badge tone="info">{service.provider_type === 'business' ? text('Business provider', 'வணிக வழங்குநர்') : text('Professional provider', 'நிபுணர் வழங்குநர்')}</Badge>
          </div>
          <h2>{providerName}</h2>
          <p className="provider-headline">{service.provider_description || (service.provider_type === 'business' ? text('Local business provider', 'உள்ளூர் வணிக வழங்குநர்') : text('Professional provider', 'நிபுணர் வழங்குநர்'))}</p>
          <p className="card-location">{service.service_area || service.location}</p>
          <Stars rating={service.rating} count={service.review_count} />
        </div>
        <Link className="text-link" href={providerHref}>{text('View profile', 'Profile-ஐ பார்க்க')}</Link>
      </Card>

      <section className="detail-section"><span className="eyebrow">{text('About the service', 'சேவை பற்றி')}</span><h2>{text('Service details', 'சேவை விவரங்கள்')}</h2><p className="detail-copy">{service.description || text('The provider will confirm the final scope and timing before the booking is accepted.', 'Booking ஏற்கப்படுவதற்கு முன் இறுதி scope மற்றும் நேரத்தை வழங்குநர் உறுதிசெய்வார்.')}</p></section>

      <section className="detail-section"><span className="eyebrow">{text('Policies', 'கொள்கைகள்')}</span><h2>{text('Cancellation and rescheduling', 'ரத்து செய்தல் மற்றும் மறுஅட்டவணை')}</h2><p className="detail-copy">{text('Cancellation and rescheduling terms will be shown during booking before you confirm your request.', 'உங்கள் request-ஐ உறுதிசெய்வதற்கு முன் booking போது cancellation மற்றும் rescheduling விதிகள் காட்டப்படும்.')}</p></section>

      <section className="detail-section" aria-labelledby="reviews-heading">
        <div className="section-heading"><div><span className="eyebrow">{text('Customer voice', 'வாடிக்கையாளர் கருத்து')}</span><h2 id="reviews-heading">{text('Reviews', 'மதிப்புரைகள்')}</h2></div><Stars rating={service.rating} count={service.review_count} /></div>
        {reviews.length ? <>
          <div className="review-summary"><strong>{service.rating.toFixed(1)} <span aria-hidden="true">★</span></strong><div className="rating-bars">{counts.map(({ star, count }) => { const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0; return <span key={star}><i style={{ width: `${pct}%` }} />{star} <small>{pct}%</small></span>; })}</div></div>
          <div className="review-list">{reviews.map((review) => <Card className="review-card" key={review.id}><div className="review-card-top"><strong>{review.reviewer_name || text('Customer', 'வாடிக்கையாளர்')}</strong><span>{formatDate(review.date)}</span></div><Stars rating={review.rating} count={0} />{review.verified_booking ? <Badge tone="success">{text('Completed booking', 'முடிந்த booking')}</Badge> : null}{review.comment ? <p>{review.comment}</p> : null}</Card>)}</div>
        </> : <p className="empty-inline">{text('No published customer reviews yet.', 'இன்னும் வெளியிடப்பட்ட வாடிக்கையாளர் மதிப்புரைகள் இல்லை.')}</p>}
      </section>
    </main>

    <aside className="detail-aside">
      <Card className="booking-summary"><div className="section-heading"><div><span className="eyebrow">{text('Booking', 'Booking')}</span><h2>{text('Booking summary', 'Booking சுருக்கம்')}</h2></div><Badge tone="success">{text('Live service', 'Live சேவை')}</Badge></div><dl><div><dt>{text('Service', 'சேவை')}</dt><dd>{service.name}</dd></div><div><dt>{text('Provider', 'வழங்குநர்')}</dt><dd>{providerName}</dd></div><div><dt>{text('Estimated price', 'மதிப்பிடப்பட்ட விலை')}</dt><dd>{money(service.base_price, service.currency)}</dd></div></dl></Card>
      <Link href={bookingHref} className="button button-primary detail-cta">{text('Choose a date and time', 'தேதி மற்றும் நேரத்தை தேர்வு செய்')}</Link>
    </aside>
    </div>
    <div className="mobile-sticky-cta"><Link href={bookingHref} className="button button-primary">{text('Choose a date and time', 'தேதி மற்றும் நேரத்தை தேர்வு செய்')}</Link></div>
  </div>;
}
