import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [reviewsClient, customerReviews, providerReviews, account, bookingDetail, reviewComposer] = await Promise.all([
  readFile(new URL('lib/reviews.ts', root), 'utf8'),
  readFile(new URL('app/reviews.tsx', root), 'utf8'),
  readFile(new URL('app/provider-reviews.tsx', root), 'utf8'),
  readFile(new URL('app/account.tsx', root), 'utf8'),
  readFile(new URL('app/bookings/[bookingId].tsx', root), 'utf8'),
  readFile(new URL('app/reviews/[bookingId].tsx', root), 'utf8'),
]);

const actionSources = [reviewsClient, providerReviews, reviewComposer].join('\n').toLowerCase();

test('native review client preserves frozen Customer and Provider review routes', () => {
  assert.ok(reviewsClient.includes("'/api/reviews'"));
  assert.ok(reviewsClient.includes('`/api/reviews?bookingId=${encodeURIComponent(bookingId)}`'));
  assert.ok(reviewsClient.includes("'/api/provider/reviews'"));
  assert.equal((reviewsClient.match(/method: 'GET'/g) ?? []).length, 3);
  assert.equal((reviewsClient.match(/method: 'POST'/g) ?? []).length, 1);
  assert.equal((reviewsClient.match(/method: 'PATCH'/g) ?? []).length, 1);
  assert.ok(reviewsClient.includes('supabase.auth.getSession()'));
  assert.ok(!reviewsClient.includes("method: 'DELETE'"));
});

test('Customer review action starts from completed booking and stays server-authoritative', () => {
  assert.ok(bookingDetail.includes("booking.status === 'completed'"));
  assert.ok(bookingDetail.includes("pathname: '/reviews/[bookingId]'"));
  assert.ok(reviewComposer.includes('fetchCustomerReviewForBooking'));
  assert.ok(reviewComposer.includes('submitCustomerReview'));
  assert.ok(reviewComposer.includes('Final eligibility, duplicate protection and review-window validation stay server-authoritative.'));
  assert.ok(reviewComposer.includes('maxLength={1000}'));
  assert.ok(reviewsClient.includes("input.rating < 1 || input.rating > 5"));
  assert.ok(customerReviews.includes('Open a completed booking to leave feedback.'));
});

test('Provider review response remains server-role gated and validated', () => {
  assert.ok(providerReviews.includes("roles.includes('professional')"));
  assert.ok(providerReviews.includes("roles.includes('business_owner')"));
  assert.ok(providerReviews.includes('saveProviderReviewResponse'));
  assert.ok(providerReviews.includes('Respond to review'));
  assert.ok(providerReviews.includes('Edit response'));
  assert.ok(providerReviews.includes('maxLength={1000}'));
  assert.ok(reviewsClient.includes('normalized.length < 3 || normalized.length > 1000'));
  assert.ok(reviewsClient.includes("body: JSON.stringify({ review_id: reviewId, response: normalized })"));
  assert.ok(!providerReviews.includes('respond_to_owned_review'));
});

test('Account continues to expose Customer and Provider review workspaces from server roles', () => {
  assert.ok(account.includes('href="/reviews"'));
  assert.ok(account.includes('href="/provider-reviews"'));
  assert.ok(account.includes("roles.includes('professional')"));
  assert.ok(account.includes("roles.includes('business_owner')"));
  assert.ok(account.includes('<ScrollView contentContainerStyle={styles.content}>'));
});

test('review actions stay outside completion, attendance, finance, recovery and recurrence mutations', () => {
  for (const forbidden of [
    '/attendance',
    '/closeout',
    '/checkout',
    '/api/payments',
    '/api/cashfree',
    '/refund',
    '/payout',
    '/settlement',
    '/reconciliation',
    '/recovery',
    'requirementoccurrencerecoverypanel',
  ]) {
    assert.ok(!actionSources.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
