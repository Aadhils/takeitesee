import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderReviewsManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider Reviews uses shared identity localization for live review UI', () => {
  assert.ok(source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(source.includes('const { t, locale } = useIdentityWorkspaceTranslations()'));
  assert.ok(!/[஀-௿]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(provider\.reviewsManager\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 25, 'expected broad Provider Reviews localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider Reviews preserves review reads, response mutation and validation', () => {
  assert.ok(source.includes("fetch('/api/provider/reviews', { cache: 'no-store' })"));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes("body: JSON.stringify({ review_id: review.id, response: responseText })"));
  assert.ok(source.includes('responseText.trim().length < 3'));
  assert.ok(source.includes('provider_response: payload.review?.provider_response ?? responseText.trim()'));
});

test('Provider Reviews preserves notification deep-link focus and booking refresh events', () => {
  assert.ok(source.includes("new URL(window.location.href).searchParams.get('booking')"));
  assert.ok(source.includes("document.getElementById(`provider-review-${targetBookingId}`)"));
  assert.ok(source.includes("element.scrollIntoView({ behavior: 'smooth', block: 'center' })"));
  assert.ok(source.includes("'booking:audit-refresh'"));
  assert.ok(source.includes("'booking:closeout-refresh'"));
});

test('Provider Reviews localizes dates and accessible star labels without changing rating data', () => {
  assert.ok(source.includes("toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })"));
  assert.ok(source.includes("<Stars value={review.rating} label={t('provider.reviewsManager.outOfFiveStars')} />"));
  assert.ok(source.includes('summary.average.toFixed(1)'));
  assert.ok(source.includes('summary.five_star_share'));
});
