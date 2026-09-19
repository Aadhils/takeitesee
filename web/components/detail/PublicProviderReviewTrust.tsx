'use client';

import Link from 'next/link';
import { usePublicProviderTranslations } from '../i18n/PublicProviderTranslations';
import { Badge, Card } from '../ui/primitives';
import type { PublicProviderReviewTrust as ReviewTrust } from '../../server/marketplace/public-provider-reviews';

function Stars({ rating, label }: { rating: number; label: string }) {
  return <span aria-label={`${rating} ${label}`} style={{ letterSpacing: 2 }}>{[1, 2, 3, 4, 5].map((star) => <span key={star} aria-hidden="true">{star <= Math.round(rating) ? '★' : '☆'}</span>)}</span>;
}

export default function PublicProviderReviewTrust({ trust }: { trust: ReviewTrust }) {
  const { locale, t } = usePublicProviderTranslations();
  const formatDate = (value: string) => {
    try { return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
    catch { return value; }
  };

  return <div className="container section-stack">
    <section className="detail-section" aria-labelledby="provider-review-trust-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t('publicProvider.reviewTrust.marketplaceTrust')}</span>
          <h2 id="provider-review-trust-heading">{t('publicProvider.reviewTrust.verifiedServiceReviews')}</h2>
        </div>
        <Badge tone={trust.total ? 'success' : 'neutral'}>{trust.total} {t(trust.total === 1 ? 'publicProvider.reviewTrust.reviewSingular' : 'publicProvider.reviewTrust.reviewPlural')}</Badge>
      </div>
      <p className="detail-copy">{t('publicProvider.reviewTrust.intro')}</p>

      {trust.reviews.length ? <div className="review-list">
        {trust.reviews.map((review) => <Card className="review-card" key={review.id}>
          <div className="review-card-top"><strong>{t('publicProvider.reviewTrust.verifiedCustomerReview')}</strong><span>{formatDate(review.created_at)}</span></div>
          <div style={{ display: 'flex', gap: '.55rem', flexWrap: 'wrap', alignItems: 'center' }}><Stars rating={review.rating} label={t('publicProvider.reviewTrust.outOfFiveStars')} /><Badge tone="success">{t('publicProvider.reviewTrust.completedBooking')}</Badge></div>
          <span className="eyebrow" style={{ display: 'block', marginTop: '.65rem' }}>{review.service_name}</span>
          {review.comment ? <p>{review.comment}</p> : <p className="summary-note">{t('publicProvider.reviewTrust.noWrittenComment')}</p>}
          {review.provider_response ? <div style={{ marginTop: '.85rem', paddingTop: '.85rem', borderTop: '1px solid var(--color-border, #d9dce5)' }}>
            <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', alignItems: 'center' }}><strong>{t('publicProvider.reviewTrust.officialProviderResponse')}</strong><Badge tone="info">{t('publicProvider.reviewTrust.providerReply')}</Badge></div>
            <p style={{ marginBottom: '.25rem' }}>{review.provider_response}</p>
            {review.provider_responded_at ? <small>{t('publicProvider.reviewTrust.responded')} {formatDate(review.provider_responded_at)}</small> : null}
          </div> : null}
          {review.service_name !== 'Completed service' ? <Link href={`/services/${encodeURIComponent(review.service_id)}`} className="text-link">{t('publicProvider.reviewTrust.viewService')}</Link> : null}
        </Card>)}
      </div> : <p className="empty-inline">{t('publicProvider.reviewTrust.empty')}</p>}
    </section>
  </div>;
}
