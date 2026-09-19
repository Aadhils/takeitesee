import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/detail/PublicProviderReviewTrust.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Public Provider review trust uses shared public-provider localization', () => {
  assert.ok(source.includes('usePublicProviderTranslations'));
  assert.ok(source.includes('const { locale, t } = usePublicProviderTranslations()'));
  assert.ok(!source.includes('const text ='));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!/[஀-௿]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(publicProvider\.reviewTrust\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 12, 'expected public-provider review trust localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Public Provider review trust preserves review and provider-response data semantics', () => {
  assert.ok(source.includes('trust.reviews.map'));
  assert.ok(source.includes('review.provider_response'));
  assert.ok(source.includes('review.provider_responded_at'));
  assert.ok(source.includes('formatDate(review.created_at)'));
  assert.ok(source.includes('formatDate(review.provider_responded_at)'));
});

test('Public Provider review trust preserves service link sentinel and destination', () => {
  assert.ok(source.includes("review.service_name !== 'Completed service'"));
  assert.ok(source.includes('href={`/services/${encodeURIComponent(review.service_id)}`}'));
});

test('Public Provider review trust localizes accessible star labels without changing ratings', () => {
  assert.ok(source.includes("<Stars rating={review.rating} label={t('publicProvider.reviewTrust.outOfFiveStars')} />"));
  assert.ok(source.includes('star <= Math.round(rating)'));
});
