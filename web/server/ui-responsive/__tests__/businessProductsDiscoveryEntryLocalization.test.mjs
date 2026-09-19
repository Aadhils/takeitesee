import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [entry, translations] = await Promise.all([
  readFile(new URL('components/discovery/BusinessProductsDiscoveryEntry.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'publicProvider.productMarketplace.eyebrow',
  'publicProvider.productMarketplace.entryTitle',
  'publicProvider.productMarketplace.entryIntro',
  'publicProvider.productMarketplace.entryBrowse',
];

test('Business product discovery entry uses shared public marketplace localization', () => {
  assert.ok(entry.includes('usePublicProviderTranslations'));
  assert.ok(entry.includes('const { t } = usePublicProviderTranslations()'));
  assert.ok(!entry.includes('useLanguage'));
  assert.ok(!entry.includes("locale === 'ta-IN'"));
  assert.ok(!/\bconst tamil\b/.test(entry));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(entry));
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(entry.includes("'" + key + "'"), key);
  }
});

test('Business product discovery entry preserves the product marketplace destination', () => {
  assert.ok(entry.includes('href="/products"'));
  assert.ok(entry.includes('className="button button-secondary"'));
  assert.ok(entry.includes('<Card'));
});

test('Business product discovery entry does not activate finance behavior', () => {
  for (const term of ["/api/pay", 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!entry.includes(term));
  }
});
