'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, EmptyState } from '../ui/primitives';
import BookingAuditTimeline from './BookingAuditTimeline';
import BookingCloseoutPanel from './BookingCloseoutPanel';
import BookingReasonDialog from './BookingReasonDialog';
import CustomerPaymentPanel from './CustomerPaymentPanel';
import { cancelBookingThroughConfiguredRepository, getBookingThroughConfiguredRepository } from '../../services/booking-repository';
import type { CustomerBooking } from '../../types/booking-domain';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

type SavedReview = { id: string; rating: number; comment?: string | null };
type CloseoutWindow = { review_window_open: boolean; review_due_at?: string; state: string; attendance_outcome: string };
const cancellationReasons = ['Plans changed', 'Booked by mistake', 'Timing no longer works', 'Found another provider', 'Other'];

function formatDeadline(value: string | undefined, locale: string) {
  if (!value) return '';
  try { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return value; }
}

export default function CustomerBookingDetail({ bookingId }: { bookingId: string }) {
  const { locale, t, status } = useOperationalTranslations();
  const [booking, setBooking] = useState<CustomerBooking>();
  const [review, setReview] = useState<SavedReview | null>();
  const [closeoutWindow, setCloseoutWindow] = useState<CloseoutWindow | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const refreshBooking = useCallback(async () => {
    const next = await getBookingThroughConfiguredRepository(bookingId as CustomerBooking['bookingId']);
    setBooking(next);
  }, [bookingId]);

  useEffect(() => {
    void refreshBooking().catch(() => setBooking(undefined));
  }, [refreshBooking]);

  useEffect(() => {
    void fetch(`/api/reviews?bookingId=${encodeURIComponent(bookingId)}`)
      .then(async (response) => response.ok ? response.json() : { review: null })
      .then((payload: { review?: SavedReview | null }) => setReview(payload.review ?? null))
      .catch(() => setReview(null));
  }, [bookingId]);

  const loadCloseoutWindow = useCallback(async () => {
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/closeout`, { cache: 'no-store' });
      const payload = await response.json() as CloseoutWindow & { error?: string };
      if (response.ok && typeof payload.review_window_open === 'boolean') setCloseoutWindow(payload);
    } catch { /* BookingCloseoutPanel renders closeout errors. */ }
  }, [bookingId]);

  useEffect(() => { void loadCloseoutWindow(); }, [loadCloseoutWindow]);
  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ bookingId?: string }>).detail;
      if (!detail?.bookingId || detail.bookingId === bookingId) void loadCloseoutWindow();
    };
    window.addEventListener('booking:closeout-refresh', refresh);
    return () => window.removeEventListener('booking:closeout-refresh', refresh);
  }, [bookingId, loadCloseoutWindow]);

  if (!booking) return <EmptyState title={t('book.notFound')}>{t('book.notFoundHelp')}</EmptyState>;

  const canManage = ['pending', 'confirmed', 'rescheduled'].includes(booking.status) && !['customer_no_show', 'provider_no_show'].includes(closeoutWindow?.attendance_outcome || '');
  const providerLabel = booking.providerName || (booking.providerType === 'business' ? t('book.businessProvider') : t('book.professionalProvider'));
  const money = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };

  const refreshCloseout = () => {
    window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId: booking.bookingId } }));
    window.dispatchEvent(new CustomEvent('booking:closeout-refresh', { detail: { bookingId: booking.bookingId } }));
  };

  const handleCancel = async (reason: string) => {
    if (!canManage || cancelBusy) return;
    setCancelBusy(true); setCancelError('');
    try {
      const updated = await cancelBookingThroughConfiguredRepository(booking.bookingId, reason);
      if (!updated) throw new Error('Booking could not be cancelled.');
      setBooking((current) => updated.providerName ? updated : { ...updated, providerName: current?.providerName });
      setCancelConfirmOpen(false); refreshCloseout();
    } catch (error) { setCancelError(error instanceof Error ? error.message : 'Booking could not be cancelled.'); }
    finally { setCancelBusy(false); }
  };

  const submitReview = async () => {
    if (!rating) { setReviewError('Please choose a star rating.'); return; }
    if (closeoutWindow && !closeoutWindow.review_window_open) { setReviewError('The review window for this booking has ended.'); return; }
    setSubmitting(true); setReviewError('');
    try {
      const response = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: booking.bookingId, rating, comment }) });
      const payload = await response.json() as { review?: SavedReview; error?: string };
      if (!response.ok || !payload.review) throw new Error(payload.error ?? 'Review could not be submitted.');
      setReview(payload.review); refreshCloseout();
    } catch (error) { setReviewError(error instanceof Error ? error.message : 'Review could not be submitted.'); }
    finally { setSubmitting(false); }
  };

  return <div className="booking-detail-page">
    <section className="booking-detail-heading">
      <div><span className="eyebrow">{booking.bookingReference}</span><h1>{booking.serviceName}</h1><p>{booking.bookingDate} · {booking.startTime} {booking.timezone}</p></div>
      <Badge tone={booking.status === 'cancelled' ? 'danger' : booking.status === 'completed' ? 'success' : 'info'}>{booking.status === 'rescheduled' ? t('book.rescheduleRequested') : status(booking.status)}</Badge>
    </section>

    <div className="booking-detail-layout">
      <main>
        <Card className="detail-status-card">
          <div className="section-heading"><div><span className="eyebrow">{t('book.currentStatus')}</span><h2>{booking.status === 'rescheduled' ? t('book.awaitingProvider') : status(booking.status)}</h2></div><Badge tone="neutral">{t('book.paymentPrefix')} {status(booking.paymentStatus)}</Badge></div>
          <p className="detail-copy">{t('book.backendNote')}</p>
          {booking.status === 'rescheduled' ? <p className="detail-copy">{t('book.rescheduleHelp')}</p> : null}
          {booking.status === 'cancelled' ? <p className="detail-copy">{t('book.cancelledHelp')}</p> : null}
        </Card>

        <Card className="policy-card"><span className="eyebrow">{t('book.information')}</span><dl className="review-details"><div><dt>{t('book.provider')}</dt><dd>{providerLabel}</dd></div><div><dt>{t('book.dateTime')}</dt><dd>{booking.bookingDate}, {booking.startTime} {booking.timezone}</dd></div><div><dt>{t('common.duration')}</dt><dd>{booking.durationMinutes} {t('common.minutes')}</dd></div><div><dt>{t('common.location')}</dt><dd>{booking.location}</dd></div><div><dt>{t('book.price')}</dt><dd>{money(booking.basePrice, booking.currency)}</dd></div></dl></Card>

        <CustomerPaymentPanel bookingId={booking.bookingId} bookingStatus={booking.status} paymentStatus={booking.paymentStatus} onPaymentUpdated={refreshBooking} />
        <BookingCloseoutPanel bookingId={booking.bookingId} allowSupport viewer="customer" />
        <BookingAuditTimeline bookingId={booking.bookingId} refreshKey={booking.updatedAt} />

        {booking.status === 'completed' ? <Card className="policy-card">
          <span className="eyebrow">{t('book.customerReview')}</span>
          <h2>{review ? t('book.thanksReview') : closeoutWindow && !closeoutWindow.review_window_open ? t('book.reviewEnded') : t('book.howService')}</h2>
          {review ? <><div style={{ fontSize: '1.6rem', letterSpacing: '.2rem', margin: '.75rem 0' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>{review.comment ? <p>{review.comment}</p> : <p>{t('book.ratingSaved')}</p>}<Badge tone="success">{t('book.reviewSubmitted')}</Badge></>
          : closeoutWindow && !closeoutWindow.review_window_open ? <><p className="detail-copy">{t('book.reviewPeriodEnded')}</p>{closeoutWindow.review_due_at ? <p className="summary-note">{t('book.reviewDeadline')}: {formatDeadline(closeoutWindow.review_due_at, locale)}.</p> : null}<Badge tone="neutral">{t('book.reviewClosed')}</Badge></>
          : <><p className="detail-copy">{t('book.rateBefore')}{closeoutWindow?.review_due_at ? ` (${formatDeadline(closeoutWindow.review_due_at, locale)})` : ''}.</p><div role="radiogroup" aria-label={t('book.starRating')} style={{ display: 'flex', gap: '.4rem', margin: '1rem 0' }}>{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" role="radio" aria-checked={rating === star} aria-label={`${star}`} onClick={() => setRating(star)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: '2rem', padding: '.15rem' }}>{star <= rating ? '★' : '☆'}</button>)}</div><label style={{ display: 'grid', gap: '.5rem' }}><strong>{t('book.commentOptional')}</strong><textarea value={comment} maxLength={1000} rows={4} onChange={(event) => setComment(event.target.value)} placeholder={t('book.commentPlaceholder')} style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit' }} /></label>{reviewError ? <p style={{ color: '#b42318' }}>{reviewError}</p> : null}<button type="button" className="button" disabled={submitting || !rating} onClick={submitReview} style={{ marginTop: '1rem' }}>{submitting ? t('book.submitting') : t('book.submitReview')}</button></>}
        </Card> : null}
      </main>

      <aside className="booking-detail-aside">
        <Card><span className="eyebrow">{t('book.actions')}</span>{canManage ? <Link href={`/bookings/${encodeURIComponent(booking.bookingId)}/reschedule`} className="button button-secondary">{t('book.reschedule')}</Link> : null}{canManage ? <button type="button" className="button button-secondary" disabled={cancelBusy} onClick={() => setCancelConfirmOpen(true)}>{cancelBusy ? t('book.cancelling') : t('book.cancel')}</button> : null}{cancelError ? <p role="alert" style={{ color: '#b42318' }}>{cancelError}</p> : null}<Link href="/explore" className="button button-secondary">{t('book.findAnother')}</Link></Card>
        <p className="support-note">{t('book.supportNote')}</p>
      </aside>
    </div>

    <BookingReasonDialog open={cancelConfirmOpen} eyebrow={t('book.cancel')} title={t('book.cancelWhy')} description={t('book.cancelDescription')} options={cancellationReasons} confirmLabel={t('book.cancel')} busy={cancelBusy} onClose={() => setCancelConfirmOpen(false)} onConfirm={handleCancel} />
  </div>;
}
