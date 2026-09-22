'use client';

import { useLanguage } from './LanguageProvider';

const english = {
  eyebrow: 'Customer reviews',
  title: 'Your completed bookings and submitted reviews.',
  intro: 'Reviews stay tied to real completed bookings. Open a booking to check its live review window, submit a rating, or see the review and provider response already connected to it.',
  loading: 'Loading your reviews…',
  loadError: 'Unable to load reviews.',
  signInTitle: 'Sign in to view your reviews',
  signInBody: 'Your completed bookings and submitted reviews are private to your account.',
  signIn: 'Sign in',
  createAccount: 'Create account',
  openBookings: 'Open my bookings',
  completed: 'Completed',
  completedDescription: 'Completed bookings in your live booking history.',
  reviewed: 'Reviewed',
  reviewedDescription: 'Completed bookings with a submitted review.',
  checkBooking: 'Check booking',
  checkBookingDescription: 'Completed bookings without a submitted review. Open the booking to check whether its server review window is still open.',
  historyEyebrow: 'Live review history',
  completedBookings: 'Completed bookings',
  businessProvider: 'Business provider',
  professionalProvider: 'Professional provider',
  reviewSubmitted: 'Review submitted',
  completedBooking: 'Completed booking',
  ratingAria: '{rating} out of 5',
  noComment: 'Rating submitted without a comment.',
  providerResponse: 'Provider response:',
  eligibilityNote: 'Review eligibility and deadline are checked live on the booking detail.',
  publishedReview: 'Published review',
  serverPolicy: 'Server policy applies',
  viewReview: 'View review',
  checkEligibility: 'Check review eligibility',
  noCompletedTitle: 'No completed bookings yet',
  noCompletedBody: 'When a service is completed, it will appear here and the booking will show whether a review can be submitted.',
  policyTitle: 'Review policy stays on the booking',
  policyBody: 'This center shows your live completed-booking and review history. The booking detail remains authoritative for completion state, review deadline, support context and review submission.',
  goBookings: 'Go to my bookings',
} as const;

export type CustomerReviewsCopy = { [K in keyof typeof english]: string };

const tamil: CustomerReviewsCopy = {
  eyebrow: 'வாடிக்கையாளர் மதிப்புரைகள்',
  title: 'உங்கள் completed bookings மற்றும் submit செய்த reviews.',
  intro: 'Reviews உண்மையான completed bookings-க்கு இணைந்தே இருக்கும். Live review window-ஐ பார்க்க, rating submit செய்ய, அல்லது ஏற்கனவே உள்ள review மற்றும் provider response-ஐ பார்க்க booking-ஐ திறக்கவும்.',
  loading: 'உங்கள் reviews load ஆகிறது…',
  loadError: 'Reviews load செய்ய முடியவில்லை.',
  signInTitle: 'உங்கள் reviews-ஐ பார்க்க sign in செய்யவும்',
  signInBody: 'உங்கள் completed bookings மற்றும் submit செய்த reviews உங்கள் account-க்கு மட்டும் private.',
  signIn: 'Sign in',
  createAccount: 'Account உருவாக்கவும்',
  openBookings: 'என் bookings-ஐ திற',
  completed: 'Completed',
  completedDescription: 'உங்கள் live booking history-ல் உள்ள completed bookings.',
  reviewed: 'Reviewed',
  reviewedDescription: 'Review submit செய்யப்பட்ட completed bookings.',
  checkBooking: 'Booking check',
  checkBookingDescription: 'Review submit செய்யாத completed bookings. Server review window இன்னும் open-ஆ இருக்கிறதா என்று booking-ஐ திறந்து பார்க்கவும்.',
  historyEyebrow: 'Live review history',
  completedBookings: 'Completed bookings',
  businessProvider: 'Business provider',
  professionalProvider: 'Professional provider',
  reviewSubmitted: 'Review submit செய்யப்பட்டது',
  completedBooking: 'Completed booking',
  ratingAria: '5-ல் {rating}',
  noComment: 'Comment இல்லாமல் rating submit செய்யப்பட்டுள்ளது.',
  providerResponse: 'Provider response:',
  eligibilityNote: 'Review eligibility மற்றும் deadline booking detail-ல் live-ஆ check செய்யப்படும்.',
  publishedReview: 'Published review',
  serverPolicy: 'Server policy applies',
  viewReview: 'Review பார்க்க',
  checkEligibility: 'Review eligibility பார்க்க',
  noCompletedTitle: 'Completed bookings இன்னும் இல்லை',
  noCompletedBody: 'Service completed ஆனதும் இங்கே வரும்; review submit செய்ய முடியுமா என்பதை booking காட்டும்.',
  policyTitle: 'Review policy booking-லேயே இருக்கும்',
  policyBody: 'இந்த center உங்கள் live completed-booking மற்றும் review history-ஐ காட்டுகிறது. Completion state, review deadline, support context மற்றும் review submission-க்கு booking detail தான் authoritative.',
  goBookings: 'என் bookings-க்கு செல்ல',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useCustomerReviewsTranslations(): CustomerReviewsCopy {
  const { locale } = useLanguage();
  return catalogs[locale] ?? english;
}
