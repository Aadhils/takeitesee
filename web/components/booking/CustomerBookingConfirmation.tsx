'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { getBookingThroughConfiguredRepository } from '../../services/booking-repository';
import type { CustomerBooking } from '../../types/booking-domain';

const bookingStatusLabels: Record<string, { en: string; ta: string }> = {
  pending: { en: 'Pending', ta: 'நிலுவையில்' },
  confirmed: { en: 'Confirmed', ta: 'உறுதிசெய்யப்பட்டது' },
  completed: { en: 'Completed', ta: 'முடிந்தது' },
  cancelled: { en: 'Cancelled', ta: 'ரத்து செய்யப்பட்டது' },
  rescheduled: { en: 'Rescheduled', ta: 'மறுஅட்டவணை செய்யப்பட்டது' },
  rejected: { en: 'Rejected', ta: 'நிராகரிக்கப்பட்டது' },
  no_show: { en: 'No-show', ta: 'வரவில்லை' },
};

const paymentStatusLabels: Record<string, { en: string; ta: string }> = {
  unpaid: { en: 'Unpaid', ta: 'செலுத்தப்படவில்லை' },
  pending: { en: 'Pending', ta: 'நிலுவையில்' },
  paid: { en: 'Paid', ta: 'செலுத்தப்பட்டது' },
  failed: { en: 'Failed', ta: 'தோல்வி' },
  refunded: { en: 'Refunded', ta: 'திருப்பிச் செலுத்தப்பட்டது' },
};

export default function CustomerBookingConfirmation({ bookingId }: { bookingId: string }) {
  const { locale } = useLanguage();
  const [booking, setBooking] = useState<CustomerBooking>();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
  const statusText = (value: string, labels: Record<string, { en: string; ta: string }>) => {
    const mapped = labels[value.toLowerCase()];
    if (!mapped) return value.replaceAll('_', ' ');
    return locale === 'ta-IN' ? mapped.ta : mapped.en;
  };
  const money = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };

  useEffect(() => {
    void getBookingThroughConfiguredRepository(bookingId as CustomerBooking['bookingId'])
      .then(setBooking)
      .catch(() => setBooking(undefined));
  }, [bookingId]);

  if (!booking) {
    return (
      <EmptyState title={text('Booking not found', 'Booking கிடைக்கவில்லை')}>
        {text('This booking could not be loaded from your account.', 'உங்கள் account-லிருந்து இந்த booking-ஐ ஏற்ற முடியவில்லை.')}
      </EmptyState>
    );
  }

  const bookingTone = booking.status === 'pending'
    ? 'warning' as const
    : booking.status === 'confirmed' || booking.status === 'completed'
      ? 'success' as const
      : 'neutral' as const;
  const requestSaved = booking.status === 'pending';

  return (
    <div className="confirmation-page">
      <section className="confirmation-panel" aria-labelledby="confirmation-heading" role="status">
        <span className="confirmation-mark" aria-hidden="true">✓</span>
        <span className="eyebrow">{text('Booking confirmation', 'Booking உறுதிப்படுத்தல்')}</span>
        <h1 id="confirmation-heading">{requestSaved ? text('Booking request saved', 'Booking request சேமிக்கப்பட்டது') : text('Booking confirmed', 'Booking உறுதிசெய்யப்பட்டது')}</h1>
        <p>{requestSaved
          ? text('Your booking request has been saved to your account and is awaiting provider confirmation.', 'உங்கள் booking request account-ல் சேமிக்கப்பட்டுள்ளது; provider confirmation காத்திருக்கிறது.')
          : text('Your booking is saved in your account. Open the booking detail to follow its current live status and available actions.', 'உங்கள் booking account-ல் சேமிக்கப்பட்டுள்ளது. தற்போதைய live நிலை மற்றும் கிடைக்கும் actions-ஐ பார்க்க booking detail-ஐ திறக்கவும்.')}</p>
        <div className="confirmation-reference"><span>{text('Booking reference', 'Booking reference')}</span><strong>{booking.bookingReference}</strong></div>
      </section>

      <div className="confirmation-layout">
        <Card>
          <div className="booking-card-top">
            <div><span className="eyebrow">{text('Service', 'சேவை')}</span><h2>{booking.serviceName}</h2></div>
            <Badge tone={bookingTone}>{statusText(booking.status, bookingStatusLabels)}</Badge>
          </div>
          <p className="card-provider">{booking.providerType === 'business' ? text('Business provider', 'வணிக வழங்குநர்') : text('Professional provider', 'நிபுணர் வழங்குநர்')}</p>
          <dl className="review-details">
            <div><dt>{text('Date and time', 'தேதி மற்றும் நேரம்')}</dt><dd>{booking.bookingDate}, {booking.startTime} {booking.timezone}</dd></div>
            <div><dt>{text('Duration', 'கால அளவு')}</dt><dd>{booking.durationMinutes} {text('minutes', 'நிமிடங்கள்')}</dd></div>
            <div><dt>{text('Location', 'இடம்')}</dt><dd>{booking.location}</dd></div>
            <div><dt>{text('Price', 'விலை')}</dt><dd>{money(booking.basePrice, booking.currency)}</dd></div>
          </dl>
          <div className="payment-line"><span>{text('Payment status', 'Payment நிலை')}</span><Badge tone="neutral">{statusText(booking.paymentStatus, paymentStatusLabels)}</Badge></div>
          <p className="summary-note">{booking.paymentStatus === 'paid'
            ? text('Payment is recorded for this booking.', 'இந்த booking-க்கு payment பதிவு செய்யப்பட்டுள்ளது.')
            : text('No successful payment is recorded for this booking yet.', 'இந்த booking-க்கு இன்னும் successful payment பதிவு செய்யப்படவில்லை.')}</p>
        </Card>

        <div className="confirmation-actions">
          <Link href={`/bookings/${booking.bookingId}`} className="button button-primary">{text('View booking', 'Booking-ஐ பார்க்க')}</Link>
          <Link href="/bookings" className="button button-secondary">{text('My bookings', 'என் bookings')}</Link>
          <Link href="/explore" className="button button-secondary">{text('Explore more services', 'மேலும் சேவைகளை பார்க்க')}</Link>
        </div>
      </div>
    </div>
  );
}
