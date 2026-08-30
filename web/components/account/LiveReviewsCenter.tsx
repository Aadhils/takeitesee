'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Badge, Card } from '../ui/primitives';

export default function LiveReviewsCenter() {
  const { locale } = useLanguage();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;

  return (
    <div className="discovery-page">
      <section className="page-intro">
        <span className="eyebrow">{text('Customer reviews', 'வாடிக்கையாளர் மதிப்புரைகள்')}</span>
        <h1>{text('Review completed services from your bookings.', 'உங்கள் bookings-ல் முடிந்த சேவைகளுக்கு மதிப்புரை அளிக்கவும்.')}</h1>
        <p>{text(
          'Reviews are tied to real completed bookings and their live review window. Open the completed booking to submit a rating, see an existing review, or check whether the review window has ended.',
          'Reviews உண்மையான completed bookings மற்றும் அவற்றின் live review window-க்கு இணைக்கப்பட்டுள்ளன. Rating submit செய்ய, ஏற்கனவே உள்ள review-ஐ பார்க்க, அல்லது review window முடிந்ததா என்று அறிய completed booking-ஐ திறக்கவும்.',
        )}</p>
      </section>

      <div className="service-grid">
        <Card className="discovery-card">
          <div className="discovery-card-content">
            <div className="card-meta"><Badge tone="success">{text('Live booking policy', 'Live booking policy')}</Badge></div>
            <h2>{text('Leave a review', 'மதிப்புரை அளிக்கவும்')}</h2>
            <p className="card-description">{text(
              'A review can be submitted only for a completed booking while its server-enforced review window is open. The booking detail shows the current eligibility and deadline.',
              'Completed booking-க்கு server enforce செய்யும் review window open இருக்கும் போது மட்டும் review submit செய்யலாம். Booking detail தற்போதைய eligibility மற்றும் deadline-ஐ காட்டும்.',
            )}</p>
            <div className="card-footer"><span>{text('Eligibility stays authoritative on the booking.', 'Eligibility booking policy-ல் authoritative ஆக இருக்கும்.')}</span><Link href="/bookings" className="button button-primary">{text('Open my bookings', 'என் bookings-ஐ திற')}</Link></div>
          </div>
        </Card>

        <Card className="discovery-card">
          <div className="discovery-card-content">
            <div className="card-meta"><Badge tone="info">{text('Published review', 'வெளியிடப்பட்ட review')}</Badge></div>
            <h2>{text('See your submitted review', 'Submit செய்த review-ஐ பார்க்கவும்')}</h2>
            <p className="card-description">{text(
              'After submission, your rating and optional comment are shown on the booking detail. Provider responses, when available, remain connected to the same closeout record.',
              'Submit செய்த பிறகு rating மற்றும் optional comment booking detail-ல் காட்டப்படும். Provider response கிடைத்தால், அதே closeout record-க்கு இணைந்தே இருக்கும்.',
            )}</p>
            <div className="card-footer"><span>{text('Customer-authored review text remains unchanged.', 'வாடிக்கையாளர் எழுதிய review text மாற்றப்படாது.')}</span><Link href="/bookings" className="button button-secondary">{text('View booking history', 'Booking history-ஐ பார்க்க')}</Link></div>
          </div>
        </Card>
      </div>

      <Card className="support-cta">
        <div>
          <h2>{text('Why reviews open from bookings', 'Reviews ஏன் bookings-ல் திறக்கப்படுகிறது')}</h2>
          <p>{text(
            'The booking owns the completion state, review deadline and support/closeout context. Keeping the review action there prevents the UI from guessing eligibility or bypassing live policy.',
            'Completion state, review deadline மற்றும் support/closeout context அனைத்தும் booking-க்கு சொந்தமானவை. Review action-ஐ அங்கே வைத்திருப்பதால் UI eligibility-ஐ guess செய்வதோ live policy-ஐ bypass செய்வதோ தவிர்க்கப்படுகிறது.',
          )}</p>
        </div>
        <Link href="/bookings" className="button button-primary">{text('Go to my bookings', 'என் bookings-க்கு செல்ல')}</Link>
      </Card>
    </div>
  );
}
