import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/safety/PortfolioMediaSafetyPanel.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'publicProvider.portfolioSafety.eyebrow',
  'publicProvider.portfolioSafety.title',
  'publicProvider.portfolioSafety.signedInUsers',
  'publicProvider.portfolioSafety.intro',
  'publicProvider.portfolioSafety.photo',
  'publicProvider.portfolioSafety.video',
  'publicProvider.portfolioSafety.sampleFallback',
  'publicProvider.portfolioSafety.reportPhoto',
  'publicProvider.portfolioSafety.reportVideo',
];

test('Portfolio media safety panel uses shared public-provider localization', () => {
  assert.ok(source.includes('usePublicProviderTranslations'));
  assert.ok(source.includes('const { t } = usePublicProviderTranslations()'));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!source.includes('const text ='));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.equal(keys.length, 9);
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Portfolio media safety panel preserves reporting targets and media branching', () => {
  assert.ok(source.includes('if (!media.length) return null'));
  assert.ok(source.includes('targetType="portfolio_media"'));
  assert.ok(source.includes('targetId={item.id}'));
  assert.ok(source.includes("item.media_type === 'image'"));
  assert.ok(source.includes('item.caption ||'));
  assert.ok(source.includes('<MarketplaceReportForm'));
});

test('Portfolio media safety panel preserves review-only guidance and avoids finance behavior', () => {
  assert.ok(translations.includes('Reporting does not automatically remove the media or suspend the professional.'));
  for (const term of ["/api/pay", 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
