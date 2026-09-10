'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Badge, Card } from '../ui/primitives';
import type { PublicProviderReviewTrust as ReviewTrust } from '../../server/marketplace/public-provider-reviews';

function Stars({ rating }: { rating: number }) {
  return <span aria-label={`${rating} out of 5 stars`} style={{ letterSpacing: 2 }}>{[1, 2, 3, 4, 5].map((star) => <span key={star} aria-hidden="true">{star <= Math.round(rating) ? '★' : '☆'}</span>)}</span>;
}

export default function PublicProviderReviewTrust({ trust }: { trust: ReviewTrust }) {
  const { locale } = useLanguage();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
  const formatDate = (value: string) => {
    try { return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
    catch { return value; }
  };

  return <div className="container section-stack">
    <section className="detail-section" aria-labelledby="provider-review-trust-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{text('Marketplace trust', 'Marketplace நம்பிக்கை')}</span>
          <h2 id="provider-review-trust-heading">{text('Verified service reviews', 'சரிபார்க்கப்பட்ட சேவை மதிப்புரைகள்')}</h2>
        </div>
        <Badge tone={trust.total ? 'success' : 'neutral'}>{trust.total} {text(trust.total === 1 ? 'review' : 'reviews', 'reviews')}</Badge>
      </div>
      <p className="detail-copy">{text(
        'These reviews come from completed TakeItEsee service bookings. Provider replies are shown as official public responses.',
        'இந்த reviews முடிந்த TakeItEsee service bookings-இலிருந்து வருகின்றன. Provider பதில்கள் அதிகாரப்பூர்வ public responses ஆக காட்டப்படும்.',
      )}</p>

      {trust.reviews.length ? <div className="review-list">
        {trust.reviews.map((review) => <Card className="review-card" key={review.id}>
          <div className="review-card-top"><strong>{text('Verified customer review', 'சரிபார்க்கப்பட்ட customer review')}</strong><span>{formatDate(review.created_at)}</span></div>
          <div style={{ display: 'flex', gap: '.55rem', flexWrap: 'wrap', alignItems: 'center' }}><Stars rating={review.rating} /><Badge tone="success">{text('Completed booking', 'முடிந்த booking')}</Badge></div>
          <span className="eyebrow" style={{ display: 'block', marginTop: '.65rem' }}>{review.service_name}</span>
          {review.comment ? <p>{review.comment}</p> : <p className="summary-note">{text('Rating submitted without a written comment.', 'எழுத்து comment இல்லாமல் rating அளிக்கப்பட்டுள்ளது.')}</p>}
          {review.provider_response ? <div style={{ marginTop: '.85rem', paddingTop: '.85rem', borderTop: '1px solid var(--color-border, #d9dce5)' }}>
            <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', alignItems: 'center' }}><strong>{text('Official provider response', 'Provider அதிகாரப்பூர்வ பதில்')}</strong><Badge tone="info">{text('Provider reply', 'Provider reply')}</Badge></div>
            <p style={{ marginBottom: '.25rem' }}>{review.provider_response}</p>
            {review.provider_responded_at ? <small>{text('Responded', 'பதில் அளிக்கப்பட்டது')} {formatDate(review.provider_responded_at)}</small> : null}
          </div> : null}
          {review.service_name !== 'Completed service' ? <Link href={`/services/${encodeURIComponent(review.service_id)}`} className="text-link">{text('View service', 'சேவையை பார்க்க')}</Link> : null}
        </Card>)}
      </div> : <p className="empty-inline">{text('No published service reviews yet.', 'இன்னும் published service reviews இல்லை.')}</p>}
    </section>
  </div>;
}
