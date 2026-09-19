'use client';

import { useEffect, useMemo, useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
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

function Stars({ value, label }: { value: number; label: string }) {
  return <span aria-label={`${value} ${label}`} style={{ letterSpacing: 3, fontSize: '1.15rem' }}>{[1, 2, 3, 4, 5].map((star) => <span key={star} aria-hidden="true">{star <= value ? '★' : '☆'}</span>)}</span>;
}

export default function ProviderReviewsManager() {
  const { t, locale } = useIdentityWorkspaceTranslations();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({ total: 0, average: 0, counts: {}, five_star_share: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [busy, setBusy] = useState(false);
  const [targetBookingId, setTargetBookingId] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/provider/reviews', { cache: 'no-store' });
      const payload = await response.json() as { reviews?: ReviewItem[]; summary?: ReviewSummary; error?: string };
      if (!response.ok || !payload.reviews || !payload.summary) throw new Error(payload.error ?? t('provider.reviewsManager.unableToLoad'));
      setReviews(payload.reviews);
      setSummary(payload.summary);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.reviewsManager.unableToLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      setTargetBookingId(new URL(window.location.href).searchParams.get('booking')?.trim() ?? '');
    } catch {
      setTargetBookingId('');
    }
    void load();
  }, []);

  useEffect(() => {
    if (loading || !targetBookingId || !reviews.some((review) => review.booking_id === targetBookingId)) return;
    const element = document.getElementById(`provider-review-${targetBookingId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => element.focus({ preventScroll: true }), 250);
  }, [loading, reviews, targetBookingId]);

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
      if (!response.ok || !payload.review) throw new Error(payload.error ?? t('provider.reviewsManager.responseSaveFailed'));
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
      setError(cause instanceof Error ? cause.message : t('provider.reviewsManager.responseSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return <LiveProviderShell active="/provider/reviews">
    <ProviderHeading eyebrow={t('provider.reviewsManager.eyebrow')} title={t('provider.reviewsManager.title')} description={t('provider.reviewsManager.description')} />
    {targetBookingId && !loading && reviews.some((review) => review.booking_id === targetBookingId) ? <Card style={{ marginBottom: '1rem' }}><strong>{t('provider.reviewsManager.notificationTitle')}</strong><p className="summary-note" style={{ marginBottom: 0 }}>{t('provider.reviewsManager.notificationBody')}</p></Card> : null}
    <div className="provider-review-summary">
      <ProviderDashboardSummary label={t('provider.reviewsManager.averageRating')} value={summary.total ? `${summary.average.toFixed(1)} / 5` : '—'} detail={`${summary.total} ${t(summary.total === 1 ? 'provider.reviewsManager.reviewsSingular' : 'provider.reviewsManager.reviewsPlural')}`} tone="success" />
      <ProviderDashboardSummary label={t('provider.reviewsManager.fiveStarShare')} value={`${summary.five_star_share}%`} detail={t('provider.reviewsManager.basedOnPublished')} tone="info" />
    </div>

    <Card className="provider-rating-distribution"><h2>{t('provider.reviewsManager.ratingDistribution')}</h2>{distribution.map((item) => <div key={item.rating}><span>{item.rating} {t(item.rating === 1 ? 'provider.reviewsManager.starSingular' : 'provider.reviewsManager.starPlural')}</span><i><b style={{ width: `${item.percentage}%` }} /></i><strong>{item.percentage}%</strong></div>)}</Card>

    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {loading ? <Card><p>{t('provider.reviewsManager.loading')}</p></Card> : null}
    {!loading && !error && reviews.length === 0 ? <Card><EmptyState title={t('provider.reviewsManager.emptyTitle')}>{t('provider.reviewsManager.emptyBody')}</EmptyState></Card> : null}

    {!loading && reviews.length ? <div className="provider-review-list">
      {reviews.map((review) => {
        const targeted = review.booking_id === targetBookingId;
        return <Card
          id={`provider-review-${review.booking_id}`}
          tabIndex={targeted ? -1 : undefined}
          className="provider-review-card"
          style={targeted ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 3px var(--color-selected)' } : undefined}
          key={review.id}
        >
          <div className="review-card-top"><div><strong>{targeted ? `${t('provider.reviewsManager.customerReview')} · ${t('provider.reviewsManager.notificationTarget')}` : t('provider.reviewsManager.customerReview')}</strong><span>{new Date(review.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div><Stars value={review.rating} label={t('provider.reviewsManager.outOfFiveStars')} /></div>
          <span className="eyebrow">{review.service_name}</span>
          <p>{review.comment || t('provider.reviewsManager.noWrittenComment')}</p>
          {review.provider_response && editing !== review.id ? <div style={{ borderTop: '1px solid var(--border, #d9dce5)', paddingTop: '.9rem', marginTop: '.9rem' }}><strong>{t('provider.reviewsManager.yourPublicResponse')}</strong><p>{review.provider_response}</p><Button type="button" variant="quiet" onClick={() => { setEditing(review.id); setResponseText(review.provider_response); }}>{t('provider.reviewsManager.editResponse')}</Button></div> : null}
          {editing === review.id ? <div style={{ display: 'grid', gap: '.65rem', marginTop: '.9rem' }}><label style={{ display: 'grid', gap: '.4rem' }}><strong>{review.provider_response ? t('provider.reviewsManager.updateResponse') : t('provider.reviewsManager.respondPublicly')}</strong><textarea rows={4} maxLength={1000} value={responseText} onChange={(event) => setResponseText(event.target.value)} placeholder={t('provider.reviewsManager.responsePlaceholder')} style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit' }} /></label><div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}><Button type="button" disabled={busy || responseText.trim().length < 3} onClick={() => void saveResponse(review)}>{busy ? t('provider.reviewsManager.saving') : t('provider.reviewsManager.publishResponse')}</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => { setEditing(null); setResponseText(''); }}>{t('provider.reviewsManager.cancel')}</Button></div></div> : null}
          {!review.provider_response && editing !== review.id ? <Button type="button" variant="secondary" onClick={() => { setEditing(review.id); setResponseText(''); }}>{t('provider.reviewsManager.respondToReview')}</Button> : null}
          <small>{t('provider.reviewsManager.verifiedCompletedBooking')} · {review.booking_id.slice(0, 8).toUpperCase()}</small>
        </Card>;
      })}
    </div> : null}
  </LiveProviderShell>;
}
