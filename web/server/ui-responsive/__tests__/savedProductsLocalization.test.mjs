import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [page, translations] = await Promise.all([
  readFile(new URL('components/account/SavedProductsPage.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/RemainingWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

test('Saved Products page uses shared account-workspace localization', () => {
  assert.ok(page.includes('useRemainingWorkspaceTranslations'));
  assert.ok(!page.includes('useLanguage'));
  assert.ok(!page.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(page));
  for (const key of [
    'savedProducts.eyebrow',
    'savedProducts.title',
    'savedProducts.intro',
    'savedProducts.signInTitle',
    'savedProducts.signInHelp',
    'savedProducts.signIn',
    'savedProducts.createAccount',
    'savedProducts.loading',
    'savedProducts.emptyTitle',
    'savedProducts.emptyHelp',
    'savedProducts.browse',
    'savedProducts.unavailableEyebrow',
    'savedProducts.unavailableTitle',
    'savedProducts.unavailableBadge',
    'savedProducts.unavailableHelp',
    'savedProducts.remove',
    'savedProducts.locationMissing',
    'savedProducts.savedBadge',
    'savedProducts.price',
    'savedProducts.stock',
    'savedProducts.savedDate',
    'savedProducts.open',
    'savedProducts.unsave',
    'savedProducts.imageAlt',
    'savedProducts.stock.inStock',
    'savedProducts.stock.madeToOrder',
    'savedProducts.stock.outOfStock',
    'savedProducts.error.load',
    'savedProducts.error.remove',
  ]) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Saved Products preserves load, auth and remove API semantics', () => {
  assert.ok(page.includes("fetch('/api/account/saved-products', { cache: 'no-store' })"));
  assert.ok(page.includes('response.status === 401'));
  assert.ok(page.includes('setAuthenticated(false)'));
  assert.ok(page.includes('setItems([])'));
  assert.ok(page.includes("fetch('/api/account/saved-products', {"));
  assert.ok(page.includes("method: 'DELETE'"));
  assert.ok(page.includes("headers: { 'Content-Type': 'application/json' }"));
  assert.ok(page.includes('JSON.stringify({ product_id: productId })'));
  assert.ok(page.includes('current.filter((item) => item.product_id !== productId)'));
  assert.ok(page.includes('if (busyId) return'));
});

test('Saved Products preserves API error precedence and localized fallbacks', () => {
  assert.ok(page.includes("payload.error || t('savedProducts.error.load')"));
  assert.ok(page.includes("cause instanceof Error ? cause.message : t('savedProducts.error.load')"));
  assert.ok(page.includes("payload.error || t('savedProducts.error.remove')"));
  assert.ok(page.includes("cause instanceof Error ? cause.message : t('savedProducts.error.remove')"));
  assert.ok(page.includes('const load = useCallback(async () => {'));
  assert.ok(page.includes('}, [t]);'));
  assert.ok(page.includes('useEffect(() => { void load(); }, [load])'));
});

test('Saved Products keeps public availability, image, money and date contracts', () => {
  assert.ok(page.includes('!item.available || !item.product'));
  assert.ok(page.includes('productImageHref(product.id)'));
  assert.ok(page.includes("t('savedProducts.imageAlt').replace('{productName}', product.name)"));
  assert.ok(page.includes('new Intl.NumberFormat(locale'));
  assert.ok(page.includes("new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })"));
  assert.ok(page.includes('product.business_location || t(\'savedProducts.locationMissing\')'));
  assert.ok(page.includes('/products/${encodeURIComponent(product.id)}'));
});

test('Saved Products preserves account destinations and empty-state hooks', () => {
  assert.ok(page.includes('active="/saved-products"'));
  assert.ok(page.includes('/login?returnTo=%2Fsaved-products'));
  assert.ok(page.includes('href="/signup"'));
  assert.ok(page.includes('href="/products"'));
  assert.ok(page.includes('saved-products-empty-card'));
  assert.ok(page.includes('saved-products-empty-actions'));
});
