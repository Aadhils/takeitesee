import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [reviewsSource, reviewTranslationsSource, helpSource, cssSource] = await Promise.all([
  readFile(new URL('components/account/LiveReviewsCenter.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/CustomerReviewsTranslations.ts', root), 'utf8'),
  readFile(new URL('components/support/LiveHelpCenter.tsx', root), 'utf8'),
  readFile(new URL('components/account/CustomerReviewsHelpResponsive.module.css', root), 'utf8'),
]);

function catalogKeys(source, start, end) {
  const segment = source.split(start)[1]?.split(end)[0] ?? '';
  return [...segment.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)].map((match) => match[1]);
}

test('Customer Reviews and Help share the focused responsive wrapper', () => {
  assert.ok(reviewsSource.includes('CustomerReviewsHelpResponsive.module.css'));
  assert.ok(helpSource.includes('CustomerReviewsHelpResponsive.module.css'));
  assert.ok(reviewsSource.includes('reviewsHelpJourney'));
  assert.ok(helpSource.includes('reviewsHelpJourney'));
});

test('Customer Reviews and Help styles cover tablet and phone layouts', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('help-topic-grid'));
  assert.ok(cssSource.includes('faq-list'));
  assert.ok(cssSource.includes('card-meta'));
  assert.ok(cssSource.includes('card-footer'));
  assert.ok(cssSource.includes('grid-template-columns: minmax(0, 1fr) !important'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('max-width: 640px'));
  assert.ok(cssSource.includes('max-width: 560px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('Customer Reviews uses shared EN/TA localization instead of local branching', () => {
  const englishKeys = catalogKeys(reviewTranslationsSource, 'const english = {', '} as const;');
  const tamilKeys = catalogKeys(reviewTranslationsSource, 'const tamil: CustomerReviewsCopy = {', '\n};');
  assert.ok(englishKeys.length > 30);
  assert.deepEqual(tamilKeys, englishKeys);
  assert.ok(reviewsSource.includes('useCustomerReviewsTranslations'));
  assert.ok(!reviewsSource.includes('useLanguage'));
  assert.ok(!reviewsSource.includes('const text ='));
  assert.ok(!reviewsSource.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(reviewsSource));
  assert.ok(reviewTranslationsSource.includes("checkEligibility: 'Check review eligibility'"));
  assert.ok(reviewTranslationsSource.includes('The booking detail remains authoritative'));
});

test('Customer Reviews live booking and review contracts remain present', () => {
  assert.ok(reviewsSource.includes('getCurrentCustomerAsync()'));
  assert.ok(reviewsSource.includes('getBookingsThroughConfiguredRepository(auth.customerId)'));
  assert.ok(reviewsSource.includes("fetch('/api/reviews', { cache: 'no-store' })"));
  assert.ok(reviewsSource.includes("booking.status === 'completed'"));
  assert.ok(reviewsSource.includes('new Map(reviews.map((review) => [review.booking_id, review]))'));
  assert.ok(reviewsSource.includes('/login?returnTo=%2Freviews'));
  assert.ok(reviewsSource.includes('encodeURIComponent(booking.bookingId)'));
  assert.ok(!reviewsSource.includes("method: 'POST'"));
  assert.ok(!reviewsSource.includes("method: 'PATCH'"));
  assert.ok(!reviewsSource.includes("method: 'DELETE'"));
});

test('Customer Reviews localization stays outside frozen finance and recurrence areas', () => {
  const combined = `${reviewsSource}\n${reviewTranslationsSource}`;
  for (const forbidden of ['Cashfree', 'cashfree', 'payout', 'settlement', 'reconciliation', 'recurrence', 'RequirementOccurrenceRecoveryPanel']) {
    assert.ok(!combined.includes(forbidden), `unexpected frozen-boundary term: ${forbidden}`);
  }
});

test('Help Center support, privacy and safety routing contracts remain present', () => {
  assert.ok(helpSource.includes("href: '/explore'"));
  assert.ok(helpSource.includes("href: '/bookings'"));
  assert.ok(helpSource.includes("href: '/account/support'"));
  assert.ok(helpSource.includes("href: '/messages'"));
  assert.ok(helpSource.includes("t('help.faq.privacy.answer')"));
  assert.ok(helpSource.includes('mailto:uandv.com@gmail.com'));
  assert.ok(helpSource.includes('href="/privacy"'));
});
