'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './CustomerReviewsHelpResponsive.module.css';
import { useCustomerReviewsTranslations } from '../i18n/CustomerReviewsTranslations';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { getCurrentCustomerAsync } from '../../services/auth-adapter';
import { getBookingsThroughConfiguredRepository } from '../../services/booking-repository';
import type { CustomerBooking } from '../../types/booking-domain';

type ReviewRow = {
  id: string;
  booking_id: string;
  service_id: string;
  rating: number;
  comment?: string | null;
  status: string;
  provider_response?: string | null;
  provider_responded_at?: string | null;
  created_at: string;
};

export default function LiveReviewsCenter() {
  const copy = useCustomerReviewsTranslations();
  const copyRef = useRef(copy);
  copyRef.current = copy;
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const auth = await getCurrentCustomerAsync();
        if (!active) return;
        if (!auth.authenticated) {
          setAuthenticated(false);
          return;
        }
        setAuthenticated(true);

        const [customerBookings, reviewsResponse] = await Promise.all([
          getBookingsThroughConfiguredRepository(auth.customerId),
          fetch('/api/reviews', { cache: 'no-store' }),
        ]);
        const reviewsPayload = await reviewsResponse.json() as { reviews?: ReviewRow[]; error?: string };
        if (!reviewsResponse.ok) throw new Error(reviewsPayload.error || copyRef.current.loadError);
        if (!active) return;
        setBookings(customerBookings);
        setReviews(reviewsPayload.reviews ?? []);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : copyRef.current.loadError);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const completedBookings = useMemo(() => bookings
    .filter((booking) => booking.status === 'completed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [bookings]);
  const reviewByBooking = useMemo(() => new Map(reviews.map((review) => [review.booking_id, review])), [reviews]);
  const reviewedCount = completedBookings.filter((booking) => reviewByBooking.has(booking.bookingId)).length;
  const checkCount = Math.max(0, completedBookings.length - reviewedCount);

  return (
    <div className={styles.reviewsHelpJourney}>
      <div className="discovery-page">
        <section className="page-intro">
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </section>

        {loading ? <Card><p>{copy.loading}</p></Card> : null}

        {!loading && authenticated === false ? <Card>
          <EmptyState title={copy.signInTitle}>{copy.signInBody}</EmptyState>
          <div className="button-row">
            <Link href="/login?returnTo=%2Freviews" className="button button-primary">{copy.signIn}</Link>
            <Link href="/signup" className="button button-secondary">{copy.createAccount}</Link>
          </div>
        </Card> : null}

        {!loading && authenticated && error ? <Card><p role="alert" className="field-error">{error}</p><Link href="/bookings" className="button button-secondary">{copy.openBookings}</Link></Card> : null}

        {!loading && authenticated && !error ? <>
          <div className="service-grid">
            <Card className="discovery-card"><div className="discovery-card-content"><div className="card-meta"><Badge tone="info">{copy.completed}</Badge></div><h2>{completedBookings.length}</h2><p className="card-description">{copy.completedDescription}</p></div></Card>
            <Card className="discovery-card"><div className="discovery-card-content"><div className="card-meta"><Badge tone="success">{copy.reviewed}</Badge></div><h2>{reviewedCount}</h2><p className="card-description">{copy.reviewedDescription}</p></div></Card>
            <Card className="discovery-card"><div className="discovery-card-content"><div className="card-meta"><Badge tone="neutral">{copy.checkBooking}</Badge></div><h2>{checkCount}</h2><p className="card-description">{copy.checkBookingDescription}</p></div></Card>
          </div>

          <section className="account-section">
            <div className="section-heading"><div><span className="eyebrow">{copy.historyEyebrow}</span><h2>{copy.completedBookings}</h2></div><Badge tone="neutral">{completedBookings.length}</Badge></div>
            {completedBookings.length ? <div className="service-grid">{completedBookings.map((booking) => {
              const review = reviewByBooking.get(booking.bookingId);
              const providerLabel = booking.providerName || (booking.providerType === 'business' ? copy.businessProvider : copy.professionalProvider);
              return <Card className="discovery-card" key={booking.bookingId}>
                <div className="discovery-card-content">
                  <div className="card-meta"><Badge tone={review ? 'success' : 'info'}>{review ? copy.reviewSubmitted : copy.completedBooking}</Badge><span>{booking.bookingReference}</span></div>
                  <h3>{booking.serviceName}</h3>
                  <p className="card-description">{providerLabel} · {booking.bookingDate}</p>
                  {review ? <div>
                    <p aria-label={copy.ratingAria.replace('{rating}', String(review.rating))} style={{ fontSize: '1.35rem', letterSpacing: '.12rem', margin: '.6rem 0' }}>{'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}</p>
                    {review.comment ? <p>{review.comment}</p> : <p className="summary-note">{copy.noComment}</p>}
                    {review.provider_response ? <p className="summary-note"><strong>{copy.providerResponse}</strong> {review.provider_response}</p> : null}
                  </div> : <p className="summary-note">{copy.eligibilityNote}</p>}
                  <div className="card-footer"><span>{review ? copy.publishedReview : copy.serverPolicy}</span><Link href={`/bookings/${encodeURIComponent(booking.bookingId)}`} className={`button ${review ? 'button-secondary' : 'button-primary'}`}>{review ? copy.viewReview : copy.checkEligibility}</Link></div>
                </div>
              </Card>;
            })}</div> : <Card><EmptyState title={copy.noCompletedTitle}>{copy.noCompletedBody}</EmptyState></Card>}
          </section>

          <Card className="support-cta">
            <div>
              <h2>{copy.policyTitle}</h2>
              <p>{copy.policyBody}</p>
            </div>
            <Link href="/bookings" className="button button-primary">{copy.goBookings}</Link>
          </Card>
        </> : null}
      </div>
    </div>
  );
}
