import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [reviewsClient, customerReviews, providerReviews, account] = await Promise.all([
  readFile(new URL('lib/reviews.ts', root), 'utf8'),
  readFile(new URL('app/reviews.tsx', root), 'utf8'),
  readFile(new URL('app/provider-reviews.tsx', root), 'utf8'),
  readFile(new URL('app/account.tsx', root), 'utf8'),
]);

const combined = [reviewsClient, customerReviews, providerReviews].join('\n').toLowerCase();

test('native review clients are bearer-authenticated GET-only reads', () => {
  assert.ok(reviewsClient.includes("'/api/reviews'"));
  assert.ok(reviewsClient.includes("'/api/provider/reviews'"));
  assert.equal((reviewsClient.match(/method: 'GET'/g) ?? []).length, 2);
  assert.ok(reviewsClient.includes('supabase.auth.getSession()'));
  assert.ok(!reviewsClient.includes("method: 'POST'"));
  assert.ok(!reviewsClient.includes("method: 'PATCH'"));
  assert.ok(!reviewsClient.includes("method: 'DELETE'"));
});

test('Customer review history remains read-only and links back to owned booking detail', () => {
  assert.ok(customerReviews.includes('fetchCustomerReviews'));
  assert.ok(customerReviews.includes('History only'));
  assert.ok(customerReviews.includes("pathname: '/bookings/[bookingId]'"));
  assert.ok(customerReviews.includes('provider_response'));
  assert.ok(!customerReviews.includes('submitReview'));
});

test('Provider review history is server-role gated and read-only', () => {
  assert.ok(providerReviews.includes("roles.includes('professional')"));
  assert.ok(providerReviews.includes("roles.includes('business_owner')"));
  assert.ok(providerReviews.includes('fetchProviderReviews'));
  assert.ok(providerReviews.includes('five_star_share'));
  assert.ok(providerReviews.includes('History only'));
  assert.ok(!providerReviews.includes('respond_to_owned_review'));
});

test('Account exposes Customer reviews and Provider reviews only for server Provider roles', () => {
  assert.ok(account.includes('href="/reviews"'));
  assert.ok(account.includes('href="/provider-reviews"'));
  assert.ok(account.includes("roles.includes('professional')"));
  assert.ok(account.includes("roles.includes('business_owner')"));
  assert.ok(account.includes('<ScrollView contentContainerStyle={styles.content}>'));
});

test('review read slice stays outside completion, payment, recovery and recurrence mutations', () => {
  for (const forbidden of [
    '/attendance',
    '/closeout',
    '/checkout',
    '/api/payments',
    '/api/cashfree',
    '/recovery',
    'requirementoccurrencerecoverypanel',
  ]) {
    assert.ok(!combined.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
