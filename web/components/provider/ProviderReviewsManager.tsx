'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, EmptyState } from '../ui/primitives';
import { ProviderDashboardSummary, ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type ReviewItem = {
  id: string;
  booking_id: string;
  service_id: string;
  service_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

type ReviewSummary = {
  total: number;
  average: number;
  counts: Record<number, number>;
  five_star_share: number;
};

function Stars({ value }: { value: number }) {
  return <span aria-label={`${value} out of 5 stars`} style={{ letterSpacing: 3, fontSize: '1.15rem' }}>{[1, 2, 3, 4, 5].map((star) => <span key={star} aria-hidden="true">{star <= value ? '★' : '☆'}</span>)}</span>;
}

export default function ProviderReviewsManager() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({ total: 0, average: 0, counts: {}, five_star_share: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/provider/reviews', { cache: 'no-store' });
        const payload = await response.json() as { reviews?: ReviewItem[]; summary?: ReviewSummary; error?: string };
        if (!response.ok || !payload.reviews || !payload.summary) throw new Error(payload.error ?? 'Unable to load reviews.');
        setReviews(payload.reviews);
        setSummary(payload.summary);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load reviews.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const distribution = useMemo(() => [5, 4, 3, 2, 1].map((rating) => {
    const count = summary.counts?.[rating] ?? 0;
    const percentage = summary.total ? Math.round((count / summary.total) * 100) : 0;
    return { rating, count, percentage };
  }), [summary]);

  return <LiveProviderShell active="/provider/reviews">
    <ProviderHeading eyebrow="Customer voice" title="Reviews" description="See real reviews from customers after completed services." />

    <div className="provider-review-summary">
      <ProviderDashboardSummary label="Average rating" value={summary.total ? `${summary.average.toFixed(1)} / 5` : '—'} detail={`${summary.total} review${summary.total === 1 ? '' : 's'}`} tone="success" />
      <ProviderDashboardSummary label="Five-star share" value={`${summary.five_star_share}%`} detail="Based on published reviews" tone="info" />
    </div>

    <Card className="provider-rating-distribution">
      <h2>Rating distribution</h2>
      {distribution.map((item) => <div key={item.rating}><span>{item.rating} star{item.rating === 1 ? '' : 's'}</span><i><b style={{ width: `${item.percentage}%` }} /></i><strong>{item.percentage}%</strong></div>)}
    </Card>

    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {loading ? <Card><p>Loading customer reviews…</p></Card> : null}
    {!loading && !error && reviews.length === 0 ? <Card><EmptyState title="No customer reviews yet">Completed bookings that receive a review will appear here.</EmptyState></Card> : null}

    {!loading && reviews.length ? <div className="provider-review-list">
      {reviews.map((review) => <Card className="provider-review-card" key={review.id}>
        <div className="review-card-top"><div><strong>Customer review</strong><span>{new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div><Stars value={review.rating} /></div>
        <span className="eyebrow">{review.service_name}</span>
        <p>{review.comment || 'No written comment provided.'}</p>
        <small>Booking {review.booking_id.slice(0, 8).toUpperCase()}</small>
      </Card>)}
    </div> : null}
  </LiveProviderShell>;
}
