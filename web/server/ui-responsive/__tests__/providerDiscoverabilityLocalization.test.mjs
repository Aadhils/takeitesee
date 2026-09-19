import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, catalog] = await Promise.all([
  readFile(new URL('components/provider/ProviderOfferingDiscoverabilityStatus.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

const keys = [...new Set(
  [...source.matchAll(/t\('(provider\.discoverability\.[^']+)'\)/g)].map((match) => match[1]),
)];

test('Provider discoverability uses the shared localization catalog without inline bilingual branches', () => {
  assert.ok(keys.length >= 45);
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes('tamil ?'));
});

test('Every Provider discoverability key exists in both English and Tamil catalogs', () => {
  for (const key of keys) {
    const occurrences = catalog.split(`'${key}'`).length - 1;
    assert.equal(occurrences, 2, `${key} should exist once in English and once in Tamil`);
  }
});

test('Provider discoverability stays read-only and preserves targeted reachability probes', () => {
  assert.ok(source.includes('/api/marketplace/services/reachability'));
  assert.ok(source.includes('/api/marketplace/products/reachability'));
  assert.ok(source.includes("fetch('/api/provider/services', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/provider/products', { cache: 'no-store' })"));
  assert.ok(!source.includes("method: 'PATCH'"));
  assert.ok(!source.includes("method: 'PUT'"));
  assert.ok(!source.includes("method: 'POST'"));
  assert.ok(!source.includes("method: 'DELETE'"));
});

test('Provider discoverability preserves blocker destinations and dynamic revision context', () => {
  assert.ok(source.includes("href: '/provider/setup'"));
  assert.ok(source.includes("href: '/account/support'"));
  assert.ok(source.includes("href: '/provider/verification'"));
  assert.ok(source.includes("href: '/provider/profile'"));
  assert.ok(source.includes("href: '/provider/public-readiness'"));
  assert.ok(source.includes("href: '/provider/products'"));
  assert.ok(source.includes('product.review_revision'));
  assert.ok(source.includes("t('provider.discoverability.currentRevisionPrefix')"));
  assert.ok(source.includes("t('provider.discoverability.currentRevisionSuffix')"));
});

test('Primary discoverability diagnostics no longer remain hardcoded in the component', () => {
  const forbidden = [
    'Confirming customer discoverability…',
    'No active offering to confirm',
    'Search reachable',
    'View public page ↗',
    'The anonymous public probe is unavailable; catalog state was not changed.',
  ];
  for (const phrase of forbidden) {
    assert.ok(!source.includes(phrase), `localized discoverability copy should not remain hardcoded: ${phrase}`);
  }
});
