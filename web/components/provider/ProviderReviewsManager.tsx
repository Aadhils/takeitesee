'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, EmptyState } from '../ui/primitives';
import { ProviderDashboardSummary, ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type ReviewItem = {
  id: string;
  booking_id: string;
  service_id: string;
  service_name: string;
  rating: number;
  comment: string;
  provider_response: string;
  provider_responded_at?: string | null;
  provider_response_updated_at?: string | null;
  created_at: string;
};

type ReviewSummary = { total: number; average: number; counts: Record<number, number>; five_star_share: number };

function Stars({ value }: { value: number }) {
  return <span aria-label={`${value} out of 5 stars`} style={{ letterSpacing: 3, fontSize: '1.15rem' }}>{[1, 2, 3, 4, 5].map((star) => <span key={star} aria-hidden="true">{star <= value ? '★' : '☆'}</span>)}</span>;
}

export default function ProviderReviewsManager() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({ total: 0, average: 0, counts: {}, five_star_share: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
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
  };

  useEffect(() => { void load(); }, []);

  const distribution = useMemo(() => [5, 4, 3, 2, 1].map((rating) => {
    const count = summary.counts?.[rating] ?? 0;
    return { rating, count, percentage: summary.total ? Math.round((count / summary.total) * 100) : 0 };
  }), [summary]);

  const saveResponse = async (review: ReviewItem) => {
    if (busy || responseText.trim().length < 3) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/provider/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: review.id, response: responseText }),
      });
      const payload = await response.json() as { review?: { provider_response?: string; provider_responded_at?: string; provider_response_updated_at?: string }; error?: string };
      if (!response.ok || !payload.review) throw new Error(payload.error ?? 'Review response could not be saved.');
      setReviews((current) => current.map((item) => item.id === review.id ? {
        ...item,
        provider_response: payload.review?.provider_response ?? responseText.trim(),
        provider_responded_at: payload.review?.provider_responded_at ?? item.provider_responded_at,
        provider_response_updated_at: payload.review?.provider_response_updated_at ?? new Date().toISOString(),
      } : item));
      setEditing(null);
      setResponseText('');
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId: review.booking_id } }));
      window.dispatchEvent(new CustomEvent('booking:closeout-refresh', { detail: { bookingId: review.booking_id } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Review response could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return <LiveProviderShell active="/provider/reviews">
    <ProviderHeading eyebrow="Customer voice" title="Reviews" description="See real reviews from completed services and publish an official provider response." />
    <div className="provider-review-summary">
      <ProviderDashboardSummary label="Average rating" value={summary.total ? `${summary.average.toFixed(1)} / 5` : '—'} detail={`${summary.total} review${summary.total === 1 ? '' : 's'}`} tone="success" />
      <ProviderDashboardSummary label="Five-star share" value={`${summary.five_star_share}%`} detail="Based on published reviews" tone="info" />
    </div>

    <Card className="provider-rating-distribution"><h2>Rating distribution</h2>{distribution.map((item) => <div key={item.rating}><span>{item.rating} star{item.rating === 1 ? '' : 's'}</span><i><b style={{ width: `${item.percentage}%` }} /></i><strong>{item.percentage}%</strong></div>)}</Card>

    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {loading ? <Card><p>Loading customer reviews…</p></Card> : null}
    {!loading && !error && reviews.length === 0 ? <Card><EmptyState title="No customer reviews yet">Completed bookings that receive a review will appear here.</EmptyState></Card> : null}

    {!loading && reviews.length ? <div className="provider-review-list">
      {reviews.map((review) => <Card className="provider-review-card" key={review.id}>
        <div className="review-card-top"><div><strong>Customer review</strong><span>{new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div><Stars value={review.rating} /></div>
        <span className="eyebrow">{review.service_name}</span>
        <p>{review.comment || 'No written comment provided.'}</p>
        {review.provider_response && editing !== review.id ? <div style={{ borderTop: '1px solid var(--border, #d9dce5)', paddingTop: '.9rem', marginTop: '.9rem' }}><strong>Your response</strong><p>{review.provider_response}</p><Button type="button" variant="quiet" onClick={() => { setEditing(review.id); setResponseText(review.provider_response); }}>Edit response</Button></div> : null}
        {editing === review.id ? <div style={{ display: 'grid', gap: '.65rem', marginTop: '.9rem' }}><label style={{ display: 'grid', gap: '.4rem' }}><strong>{review.provider_response ? 'Update your response' : 'Respond to this review'}</strong><textarea rows={4} maxLength={1000} value={responseText} onChange={(event) => setResponseText(event.target.value)} placeholder="Thank the customer or respond professionally to their feedback." style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit' }} /></label><div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}><Button type="button" disabled={busy || responseText.trim().length < 3} onClick={() => void saveResponse(review)}>{busy ? 'Saving…' : 'Publish response'}</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => { setEditing(null); setResponseText(''); }}>Cancel</Button></div></div> : null}
        {!review.provider_response && editing !== review.id ? <Button type="button" variant="secondary" onClick={() => { setEditing(review.id); setResponseText(''); }}>Respond to review</Button> : null}
        <small>Booking {review.booking_id.slice(0, 8).toUpperCase()}</small>
      </Card>)}
    </div> : null}
  </LiveProviderShell>;
}
