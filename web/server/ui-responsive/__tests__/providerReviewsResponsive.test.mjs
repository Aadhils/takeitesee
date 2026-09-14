import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, managerSource, cssSource] = await Promise.all([
  readFile(new URL('app/provider/reviews/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderReviewsManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderReviewsResponsive.module.css', root), 'utf8'),
]);

test('Provider Reviews route uses responsive wrapper', () => {
  assert.ok(routeSource.includes('ProviderReviewsResponsive.module.css'));
  assert.ok(routeSource.includes('reviewsJourney'));
  assert.ok(routeSource.includes('ProviderReviewsManager'));
});

test('Provider Reviews styles cover phone and tablet layouts', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('provider-review-summary'));
  assert.ok(cssSource.includes('provider-rating-distribution'));
  assert.ok(cssSource.includes('review-card-top'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('font-size: 16px'));
  assert.ok(cssSource.includes('max-width: 760px'));
  assert.ok(cssSource.includes('max-width: 560px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('Provider Reviews workflow contracts remain present', () => {
  assert.ok(managerSource.includes("fetch('/api/provider/reviews'"));
  assert.ok(managerSource.includes("method: 'PATCH'"));
  assert.ok(managerSource.includes('review_id: review.id'));
  assert.ok(managerSource.includes('provider_response'));
  assert.ok(managerSource.includes("searchParams.get('booking')"));
  assert.ok(managerSource.includes('scrollIntoView'));
  assert.ok(managerSource.includes("booking:audit-refresh"));
  assert.ok(managerSource.includes("booking:closeout-refresh"));
  assert.ok(managerSource.includes('five_star_share'));
});
