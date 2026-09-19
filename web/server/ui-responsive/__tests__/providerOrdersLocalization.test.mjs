import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [listSource, detailSource, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderOrdersManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderOrderDetail.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider orders list and detail use the shared orders catalog', () => {
  assert.ok(listSource.includes('const { locale, t } = useIdentityWorkspaceTranslations();'));
  assert.ok(detailSource.includes('const { locale, t } = useIdentityWorkspaceTranslations();'));
  assert.ok(!listSource.includes('const tamil'));
  assert.ok(!detailSource.includes('const tamil'));
  assert.ok(!listSource.includes('tamil ?'));
  assert.ok(!detailSource.includes('tamil ?'));

  const keys = [...new Set([
    ...[...listSource.matchAll(/t\('(provider\.orders\.[^']+)'\)/g)].map((match) => match[1]),
    ...[...detailSource.matchAll(/t\('(provider\.orders\.[^']+)'\)/g)].map((match) => match[1]),
  ])];
  assert.ok(keys.length >= 60, 'expected shared order localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider orders preserve list/detail data and transition contracts', () => {
  assert.ok(listSource.includes("fetch('/api/provider/orders', { cache: 'no-store' })"));
  assert.ok(detailSource.includes("fetch('/api/provider/orders', { cache: 'no-store' })"));
  assert.ok(detailSource.includes('fetch(`/api/provider/orders/${encodeURIComponent(order.id)}`'));
  assert.ok(detailSource.includes("method: 'PATCH'"));
  assert.ok(detailSource.includes("type OrderAction = 'accept' | 'decline' | 'fulfill'"));
  assert.ok(detailSource.includes("transition('accept')"));
  assert.ok(detailSource.includes("transition('decline')"));
  assert.ok(detailSource.includes("transition('fulfill')"));
});

test('Provider orders preserve the explicit non-payment boundary in both locales', () => {
  assert.ok(translations.includes('Payment and Cashfree are not active here.'));
  assert.ok(translations.includes('TakeItEsee payment and Cashfree are not active for this order.'));
  assert.ok(translations.includes('Payment/Cashfree இங்கு செயல்படாது.'));
  assert.ok(translations.includes('TakeItEsee payment/Cashfree இந்த order-ல் செயல்படாது.'));
});
