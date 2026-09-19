import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderProductsManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Business Products uses shared localization instead of local Tamil branching', () => {
  assert.ok(source.includes('const { locale, t } = useIdentityWorkspaceTranslations();'));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes('tamil ?'));

  const keys = [...new Set([...source.matchAll(/t\('(provider\.products\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 70, 'expected the Business Products surface to use the shared product catalog');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Business Products keeps CRUD, revision review and readiness contracts unchanged', () => {
  assert.ok(source.includes("fetch('/api/provider/products'"));
  assert.ok(source.includes("fetch('/api/provider/profile'"));
  assert.ok(source.includes("profilePayload.profile.provider_type !== 'business'"));
  assert.ok(source.includes("method: 'POST'"));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes('/launch`'));
  assert.ok(source.includes("method: 'DELETE'"));
  assert.ok(source.includes('review_revision'));
  assert.ok(source.includes('marketplace_disclosure_complete'));
  assert.ok(source.includes("readiness.trust_status === 'suspended'"));
  assert.ok(source.includes("readiness.trust_status === 'reverification_required'"));
  assert.ok(source.includes("t('provider.products.revisionLaunchBody')"));
});

test('Business Products keeps the disabled payment boundary explicit in both locale catalogs', () => {
  assert.ok(translations.includes('TakeItEsee payment and Cashfree are still disabled.'));
  assert.ok(translations.includes('TakeItEsee payment/Cashfree இன்னும் enable செய்யப்படவில்லை.'));
});
