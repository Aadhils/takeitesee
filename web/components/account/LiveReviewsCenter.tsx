'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';
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
  const { locale } = useLanguage();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
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
        if (!reviewsResponse.ok) throw new Error(reviewsPayload.error || 'Unable to load reviews.');
        if (!active) return;
        setBookings(customerBookings);
        setReviews(reviewsPayload.reviews ?? []);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to load reviews.');
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
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">{text('Customer reviews', 'வாடிக்கையாளர் மதிப்புரைகள்')}</span>
        <h1>{text('Your completed bookings and submitted reviews.', 'உங்கள் completed bookings மற்றும் submit செய்த reviews.')}</h1>
        <p>{text(
          'Reviews stay tied to real completed bookings. Open a booking to check its live review window, submit a rating, or see the review and provider response already connected to it.',
          'Reviews உண்மையான completed bookings-க்கு இணைந்தே இருக்கும். Live review window-ஐ பார்க்க, rating submit செய்ய, அல்லது ஏற்கனவே உள்ள review மற்றும் provider response-ஐ பார்க்க booking-ஐ திறக்கவும்.',
        )}</p>
      </section>

      {loading ? <Card><p>{text('Loading your reviews…', 'உங்கள் reviews load ஆகிறது…')}</p></Card> : null}

      {!loading && authenticated === false ? <Card>
        <EmptyState title={text('Sign in to view your reviews', 'உங்கள் reviews-ஐ பார்க்க sign in செய்யவும்')}>
          {text('Your completed bookings and submitted reviews are private to your account.', 'உங்கள் completed bookings மற்றும் submit செய்த reviews உங்கள் account-க்கு மட்டும் private.')}
        </EmptyState>
        <div className="button-row">
          <Link href="/login?returnTo=%2Freviews" className="button button-primary">{text('Sign in', 'Sign in')}</Link>
          <Link href="/signup" className="button button-secondary">{text('Create account', 'Account உருவாக்கவும்')}</Link>
        </div>
      </Card> : null}

      {!loading && authenticated && error ? <Card><p role="alert" className="field-error">{error}</p><Link href="/bookings" className="button button-secondary">{text('Open my bookings', 'என் bookings-ஐ திற')}</Link></Card> : null}

      {!loading && authenticated && !error ? <>
        <div className="service-grid">
          <Card className="discovery-card"><div className="discovery-card-content"><div className="card-meta"><Badge tone="info">{text('Completed', 'Completed')}</Badge></div><h2>{completedBookings.length}</h2><p className="card-description">{text('Completed bookings in your live booking history.', 'உங்கள் live booking history-ல் உள்ள completed bookings.')}</p></div></Card>
          <Card className="discovery-card"><div className="discovery-card-content"><div className="card-meta"><Badge tone="success">{text('Reviewed', 'Reviewed')}</Badge></div><h2>{reviewedCount}</h2><p className="card-description">{text('Completed bookings with a submitted review.', 'Review submit செய்யப்பட்ட completed bookings.')}</p></div></Card>
          <Card className="discovery-card"><div className="discovery-card-content"><div className="card-meta"><Badge tone="neutral">{text('Check booking', 'Booking check')}</Badge></div><h2>{checkCount}</h2><p className="card-description">{text('Completed bookings without a submitted review. Open the booking to check whether its server review window is still open.', 'Review submit செய்யாத completed bookings. Server review window இன்னும் open-ஆ இருக்கிறதா என்று booking-ஐ திறந்து பார்க்கவும்.')}</p></div></Card>
        </div>

        <section className="account-section">
          <div className="section-heading"><div><span className="eyebrow">{text('Live review history', 'Live review history')}</span><h2>{text('Completed bookings', 'Completed bookings')}</h2></div><Badge tone="neutral">{completedBookings.length}</Badge></div>
          {completedBookings.length ? <div className="service-grid">{completedBookings.map((booking) => {
            const review = reviewByBooking.get(booking.bookingId);
            const providerLabel = booking.providerName || (booking.providerType === 'business' ? text('Business provider', 'Business provider') : text('Professional provider', 'Professional provider'));
            return <Card className="discovery-card" key={booking.bookingId}>
              <div className="discovery-card-content">
                <div className="card-meta"><Badge tone={review ? 'success' : 'info'}>{review ? text('Review submitted', 'Review submit செய்யப்பட்டது') : text('Completed booking', 'Completed booking')}</Badge><span>{booking.bookingReference}</span></div>
                <h3>{booking.serviceName}</h3>
                <p className="card-description">{providerLabel} · {booking.bookingDate}</p>
                {review ? <div>
                  <p aria-label={`${review.rating} out of 5`} style={{ fontSize: '1.35rem', letterSpacing: '.12rem', margin: '.6rem 0' }}>{'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}</p>
                  {review.comment ? <p>{review.comment}</p> : <p className="summary-note">{text('Rating submitted without a comment.', 'Comment இல்லாமல் rating submit செய்யப்பட்டுள்ளது.')}</p>}
                  {review.provider_response ? <p className="summary-note"><strong>{text('Provider response:', 'Provider response:')}</strong> {review.provider_response}</p> : null}
                </div> : <p className="summary-note">{text('Review eligibility and deadline are checked live on the booking detail.', 'Review eligibility மற்றும் deadline booking detail-ல் live-ஆ check செய்யப்படும்.')}</p>}
                <div className="card-footer"><span>{review ? text('Published review', 'Published review') : text('Server policy applies', 'Server policy applies')}</span><Link href={`/bookings/${encodeURIComponent(booking.bookingId)}`} className={`button ${review ? 'button-secondary' : 'button-primary'}`}>{review ? text('View review', 'Review பார்க்க') : text('Check review eligibility', 'Review eligibility பார்க்க')}</Link></div>
              </div>
            </Card>;
          })}</div> : <Card><EmptyState title={text('No completed bookings yet', 'Completed bookings இன்னும் இல்லை')}>{text('When a service is completed, it will appear here and the booking will show whether a review can be submitted.', 'Service completed ஆனதும் இங்கே வரும்; review submit செய்ய முடியுமா என்பதை booking காட்டும்.')}</EmptyState></Card>}
        </section>

        <Card className="support-cta">
          <div>
            <h2>{text('Review policy stays on the booking', 'Review policy booking-லேயே இருக்கும்')}</h2>
            <p>{text(
              'This center shows your live completed-booking and review history. The booking detail remains authoritative for completion state, review deadline, support context and review submission.',
              'இந்த center உங்கள் live completed-booking மற்றும் review history-ஐ காட்டுகிறது. Completion state, review deadline, support context மற்றும் review submission-க்கு booking detail தான் authoritative.',
            )}</p>
          </div>
          <Link href="/bookings" className="button button-primary">{text('Go to my bookings', 'என் bookings-க்கு செல்ல')}</Link>
        </Card>
      </> : null}
    </div>
  );
}
