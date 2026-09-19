import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, jumpNav] = await Promise.all([
  readFile(new URL('components/detail/BusinessStorefrontProducts.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
  readFile(new URL('components/detail/PublicProfileJumpNav.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Business storefront products use shared public-provider localization', () => {
  assert.ok(source.includes('usePublicProviderTranslations'));
  assert.ok(source.includes('const { locale, t } = usePublicProviderTranslations()'));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(source));

  for (const key of [
    'publicProvider.businessProducts.aria',
    'publicProvider.businessProducts.salesEyebrow',
    'publicProvider.businessProducts.title',
    'publicProvider.businessProducts.intro',
    'publicProvider.businessProducts.inStock',
    'publicProvider.businessProducts.madeToOrder',
    'publicProvider.businessProducts.outOfStock',
    'publicProvider.businessProducts.imageAlt',
    'publicProvider.businessProducts.quantity',
    'publicProvider.businessProducts.orderNote',
    'publicProvider.businessProducts.noteHint',
    'publicProvider.businessProducts.requestOrder',
    'publicProvider.businessProducts.orderOnlyNote',
    'publicProvider.businessProducts.orderSent',
    'publicProvider.businessProducts.viewOrders',
    'publicProvider.businessProducts.unavailable',
    'publicProvider.businessProducts.requestError',
  ]) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Business storefront products preserve order-request API and auth return behavior', () => {
  assert.ok(source.includes("fetch('/api/orders'"));
  assert.ok(source.includes("method: 'POST'"));
  assert.ok(source.includes('product_id: product.id'));
  assert.ok(source.includes('quantity: draft.quantity'));
  assert.ok(source.includes("customer_note: draft.note.trim() || null"));
  assert.ok(source.includes('response.status === 401'));
  assert.ok(source.includes('/login?returnTo='));
});

test('Business storefront products preserve stock, quantity and image-fallback semantics', () => {
  assert.ok(source.includes("product.stock_mode !== 'out_of_stock'"));
  assert.ok(source.includes("mode === 'in_stock'"));
  assert.ok(source.includes("mode === 'made_to_order'"));
  assert.ok(source.includes('min={1}'));
  assert.ok(source.includes('max={999}'));
  assert.ok(source.includes('Math.max(1, Math.min(999, Math.trunc(next)))'));
  assert.ok(source.includes('product.has_primary_image !== false'));
  assert.ok(source.includes('setImageFailures'));
});

test('Business storefront products preserve order-request-only finance boundary copy', () => {
  assert.ok(translations.includes('TakeItEsee payment and Cashfree are not active at this stage.'));
  assert.ok(translations.includes('There is no online payment or automatic stock deduction.'));
  assert.ok(source.includes("t('publicProvider.businessProducts.intro')"));
  assert.ok(source.includes("t('publicProvider.businessProducts.orderOnlyNote')"));
});

test('Business storefront products preserve money formatting and successful-order reset', () => {
  assert.ok(source.includes('new Intl.NumberFormat(locale'));
  assert.ok(source.includes("currency: product.currency || 'INR'"));
  assert.ok(source.includes("[product.id]: { quantity: 1, note: '' }"));
  assert.ok(source.includes('href="/orders"'));
});


test('Business storefront products keep the public jump-navigation selector contract', () => {
  assert.ok(source.includes("aria-label={t('publicProvider.businessProducts.aria')}"));
  assert.ok(translations.includes("'publicProvider.businessProducts.aria': 'Business products'"));
  assert.ok(jumpNav.includes('section[aria-label="Business products"]'));
});
