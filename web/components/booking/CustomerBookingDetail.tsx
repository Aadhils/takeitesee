'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, EmptyState } from '../ui/primitives';
import BookingReasonDialog from './BookingReasonDialog';
import { cancelBookingThroughConfiguredRepository, getBookingThroughConfiguredRepository } from '../../services/booking-repository';
import type { CustomerBooking } from '../../types/booking-domain';
import { discoveryServices, displayText } from '../../data/discovery-fixtures';
import { formatMoney } from '../../types/money';

type SavedReview = { id: string; rating: number; comment?: string | null };
const cancellationReasons = ['Plans changed', 'Booked by mistake', 'Timing no longer works', 'Found another provider', 'Other'];

export default function CustomerBookingDetail({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<CustomerBooking>();
  const [review, setReview] = useState<SavedReview | null>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  useEffect(() => {
    void getBookingThroughConfiguredRepository(bookingId as CustomerBooking['bookingId'])
      .then(setBooking)
      .catch(() => setBooking(undefined));
  }, [bookingId]);

  useEffect(() => {
    void fetch(`/api/reviews?bookingId=${encodeURIComponent(bookingId)}`)
      .then(async (response) => response.ok ? response.json() : { review: null })
      .then((payload: { review?: SavedReview | null }) => setReview(payload.review ?? null))
      .catch(() => setReview(null));
  }, [bookingId]);

  if (!booking) {
    return <EmptyState title="Booking not found">This booking is unavailable or does not belong to your account.</EmptyState>;
  }

  const service = discoveryServices.find((item) => item.id === booking.serviceId);
  const canManage = ['pending', 'confirmed', 'rescheduled'].includes(booking.status);
  const providerLabel = booking.providerName || (booking.providerType === 'business' ? 'Business provider' : 'Professional provider');

  const handleCancel = async (reason: string) => {
    if (!canManage || cancelBusy) return;
    setCancelBusy(true);
    setCancelError('');
    try {
      const updated = await cancelBookingThroughConfiguredRepository(booking.bookingId, reason);
      if (!updated) throw new Error('Booking could not be cancelled.');
      setBooking((current) => updated.providerName ? updated : { ...updated, providerName: current?.providerName });
      setCancelConfirmOpen(false);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Booking could not be cancelled.');
    } finally {
      setCancelBusy(false);
    }
  };

  const submitReview = async () => {
    if (!rating) {
      setReviewError('Please choose a star rating.');
      return;
    }
    setSubmitting(true);
    setReviewError('');
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.bookingId, rating, comment }),
      });
      const payload = await response.json() as { review?: SavedReview; error?: string };
      if (!response.ok || !payload.review) throw new Error(payload.error ?? 'Review could not be submitted.');
      setReview(payload.review);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Review could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="booking-detail-page">
      <section className="booking-detail-heading">
        <div>
          <span className="eyebrow">{booking.bookingReference}</span>
          <h1>{service ? displayText(service.service_name) : booking.serviceName}</h1>
          <p>{booking.bookingDate} · {booking.startTime} {booking.timezone}</p>
        </div>
        <Badge tone={booking.status === 'cancelled' ? 'danger' : booking.status === 'completed' ? 'success' : 'info'}>{booking.status === 'rescheduled' ? 'reschedule requested' : booking.status}</Badge>
      </section>

      <div className="booking-detail-layout">
        <main>
          <Card className="detail-status-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Current booking status</span>
                <h2>{booking.status === 'rescheduled' ? 'Awaiting provider confirmation' : booking.status}</h2>
              </div>
              <Badge tone="neutral">Payment {booking.paymentStatus}</Badge>
            </div>
            <p className="detail-copy">This booking is managed by the configured takeitesee backend.</p>
            {booking.status === 'rescheduled' ? (
              <p className="detail-copy">Your requested new time is reserved and has been sent to the provider for confirmation. The previous slot was released when the reschedule request was saved.</p>
            ) : null}
            {booking.status === 'cancelled' ? (
              <p className="detail-copy">This booking has been cancelled. Its reserved time is no longer treated as occupied by availability checks.</p>
            ) : null}
          </Card>

          <Card className="policy-card">
            <span className="eyebrow">Booking information</span>
            <dl className="review-details">
              <div><dt>Provider</dt><dd>{providerLabel}</dd></div>
              <div><dt>Date and time</dt><dd>{booking.bookingDate}, {booking.startTime} {booking.timezone}</dd></div>
              <div><dt>Duration</dt><dd>{booking.durationMinutes} minutes</dd></div>
              <div><dt>Location</dt><dd>{booking.location}</dd></div>
              <div><dt>Price</dt><dd>{formatMoney({ amount: booking.basePrice, currency: booking.currency })}</dd></div>
            </dl>
          </Card>

          {booking.status === 'completed' ? (
            <Card className="policy-card">
              <span className="eyebrow">Customer review</span>
              <h2>{review ? 'Thanks for your review' : 'How was your service?'}</h2>
              {review ? (
                <>
                  <div style={{ fontSize: '1.6rem', letterSpacing: '.2rem', margin: '.75rem 0' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
                  {review.comment ? <p>{review.comment}</p> : <p>Your rating has been saved.</p>}
                  <Badge tone="success">Review submitted</Badge>
                </>
              ) : (
                <>
                  <p className="detail-copy">Rate this completed service. You can submit one review for this booking.</p>
                  <div role="radiogroup" aria-label="Star rating" style={{ display: 'flex', gap: '.4rem', margin: '1rem 0' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" role="radio" aria-checked={rating === star} aria-label={`${star} star${star > 1 ? 's' : ''}`} onClick={() => setRating(star)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: '2rem', padding: '.15rem' }}>
                        {star <= rating ? '★' : '☆'}
                      </button>
                    ))}
                  </div>
                  <label style={{ display: 'grid', gap: '.5rem' }}>
                    <strong>Comment (optional)</strong>
                    <textarea value={comment} maxLength={1000} rows={4} onChange={(event) => setComment(event.target.value)} placeholder="Tell us about your experience" style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit' }} />
                  </label>
                  {reviewError ? <p style={{ color: '#b42318' }}>{reviewError}</p> : null}
                  <button type="button" className="button" disabled={submitting || !rating} onClick={submitReview} style={{ marginTop: '1rem' }}>{submitting ? 'Submitting…' : 'Submit review'}</button>
                </>
              )}
            </Card>
          ) : null}
        </main>

        <aside className="booking-detail-aside">
          <Card>
            <span className="eyebrow">Actions</span>
            {canManage ? <Link href={`/bookings/${encodeURIComponent(booking.bookingId)}/reschedule`} className="button button-secondary">Reschedule booking</Link> : null}
            {canManage ? (
              <button type="button" className="button button-secondary" disabled={cancelBusy} onClick={() => setCancelConfirmOpen(true)}>
                {cancelBusy ? 'Cancelling…' : 'Cancel booking'}
              </button>
            ) : null}
            {cancelError ? <p role="alert" style={{ color: '#b42318' }}>{cancelError}</p> : null}
            <Link href="/explore" className="button button-secondary">Find another service</Link>
          </Card>
          <p className="support-note">Rescheduling uses live provider availability, records your reason, releases the old slot, reserves the new slot, and requires provider confirmation. Cancellation releases the reserved slot and records your reason.</p>
        </aside>
      </div>

      <BookingReasonDialog
        open={cancelConfirmOpen}
        eyebrow="Cancel booking"
        title="Why are you cancelling?"
        description="Choose a reason before cancelling. The provider will be notified and the reserved time will be released."
        options={cancellationReasons}
        confirmLabel="Cancel booking"
        busy={cancelBusy}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleCancel}
      />
    </div>
  );
}
