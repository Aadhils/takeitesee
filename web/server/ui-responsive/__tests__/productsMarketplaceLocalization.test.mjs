import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [page, filters, translations] = await Promise.all([
  readFile(new URL('app/products/page.tsx', root), 'utf8'),
  readFile(new URL('components/discovery/ProductSmartFilters.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

test('Product marketplace and smart filters use shared localization', () => {
  for (const source of [page, filters]) {
    assert.ok(source.includes('usePublicProviderTranslations'));
    assert.ok(!source.includes('useLanguage'));
    assert.ok(!source.includes('const tamil ='));
    assert.ok(!/[஀-௿]/u.test(source));
  }
  for (const key of [
    'publicProvider.productMarketplace.eyebrow',
    'publicProvider.productMarketplace.title',
    'publicProvider.productMarketplace.intro',
    'publicProvider.productMarketplace.browseServices',
    'publicProvider.productMarketplace.browseBusinesses',
    'publicProvider.productMarketplace.savedProducts',
    'publicProvider.productMarketplace.searchLabel',
    'publicProvider.productMarketplace.searchPlaceholder',
    'publicProvider.productMarketplace.resultsEyebrow',
    'publicProvider.productMarketplace.loading',
    'publicProvider.productMarketplace.resultsFor',
    'publicProvider.productMarketplace.resultsCount',
    'publicProvider.productMarketplace.unavailableTitle',
    'publicProvider.productMarketplace.productLabel',
    'publicProvider.productMarketplace.shopOpen',
    'publicProvider.productMarketplace.shopClosed',
    'publicProvider.productMarketplace.verifiedBusiness',
    'publicProvider.productMarketplace.saved',
    'publicProvider.productMarketplace.orderOnly',
    'publicProvider.productMarketplace.signInToSave',
    'publicProvider.productMarketplace.viewProduct',
    'publicProvider.productMarketplace.requestProduct',
    'publicProvider.productMarketplace.loadMore',
    'publicProvider.productMarketplace.endCatalog',
    'publicProvider.productMarketplace.noMatchesTitle',
    'publicProvider.productMarketplace.noMatchesHelp',
    'publicProvider.productMarketplace.disclaimer',
    'publicProvider.productMarketplace.filters',
    'publicProvider.productMarketplace.filterProducts',
    'publicProvider.productMarketplace.filterHelp',
    'publicProvider.productMarketplace.stock',
    'publicProvider.productMarketplace.shop',
    'publicProvider.productMarketplace.anyStock',
    'publicProvider.productMarketplace.orderable',
    'publicProvider.productMarketplace.anyShop',
    'publicProvider.productMarketplace.openOnly',
    'publicProvider.productMarketplace.sortResults',
    'publicProvider.productMarketplace.relevance',
    'publicProvider.productMarketplace.lowPrice',
    'publicProvider.productMarketplace.highPrice',
    'publicProvider.productMarketplace.name',
    'publicProvider.productMarketplace.clear',
    'publicProvider.productMarketplace.showOne',
    'publicProvider.productMarketplace.showMany',
    'publicProvider.productMarketplace.updating',
    'publicProvider.productMarketplace.activeFilters',
    'publicProvider.productMarketplace.closeFilters',
    'publicProvider.productMarketplace.closeSort',
    'publicProvider.productMarketplace.loadError',
    'publicProvider.productMarketplace.loadMoreError',
  ]) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});


test('Product marketplace localizes fallback errors while preserving API error precedence', () => {
  assert.ok(page.includes("payload.error || t('publicProvider.productMarketplace.loadError')"));
  assert.ok(page.includes("loadError instanceof Error ? loadError.message : t('publicProvider.productMarketplace.loadError')"));
  assert.ok(page.includes("payload.error || t('publicProvider.savedProduct.loadError')"));
  assert.ok(page.includes("cause instanceof Error ? cause.message : t('publicProvider.savedProduct.loadError')"));
  assert.ok(page.includes("saved ? t('publicProvider.savedProduct.removeError') : t('publicProvider.savedProduct.saveError')"));
  assert.ok(page.includes("cause instanceof Error ? cause.message : t('publicProvider.savedProduct.updateError')"));
  assert.ok(page.includes("payload.error || t('publicProvider.productMarketplace.loadMoreError')"));
  assert.ok(page.includes("cause instanceof Error ? cause.message : t('publicProvider.productMarketplace.loadMoreError')"));
  assert.ok(page.includes("}, [serverQuery, shop, sort, stock, t, urlReady]);"));
  assert.ok(page.includes("}, [t]);"));

  for (const raw of [
    'Product marketplace unavailable.',
    'Unable to load saved Products.',
    'Unable to remove saved Product.',
    'Unable to save Product.',
    'Unable to update saved Product.',
    'Unable to load more Products.',
  ]) {
    assert.equal(page.includes(raw), false);
  }
});

test('Product marketplace preserves URL state, debounce and server-side catalog query contract', () => {
  assert.ok(page.includes("const productPageSize = 24"));
  assert.ok(page.includes("if (query.trim()) params.set('q', query.trim())"));
  assert.ok(page.includes("if (stock !== 'any') params.set('stock', stock)"));
  assert.ok(page.includes("if (shop !== 'any') params.set('shop', shop)"));
  assert.ok(page.includes("if (sort !== 'relevance') params.set('sort', sort)"));
  assert.ok(page.includes("params.set('limit', String(productPageSize))"));
  assert.ok(page.includes("window.setTimeout(() => setServerQuery(query.trim()), 250)"));
  assert.ok(page.includes("window.history.replaceState(null, '', search ? `/products?${search}` : '/products')"));
  assert.ok(page.includes("fetch(`/api/marketplace/products?${params.toString()}`"));
  assert.ok(page.includes('new AbortController()'));
  assert.ok(page.includes('controller.abort()'));
});

test('Product marketplace preserves saved Product shortlist and auth-return behavior', () => {
  assert.ok(page.includes("fetch('/api/account/saved-products', { cache: 'no-store' })"));
  assert.ok(page.includes('response.status === 401'));
  assert.ok(page.includes("fetch('/api/account/saved-products', {"));
  assert.ok(page.includes("method: saved ? 'DELETE' : 'POST'"));
  assert.ok(page.includes('JSON.stringify({ product_id: productId })'));
  assert.ok(page.includes('window.location.assign(`/login?returnTo=${encodeURIComponent(currentContext)}`)'));
  assert.ok(page.includes('setSavedProductIds((current) => {'));
  assert.ok(page.includes('if (saved) next.delete(productId); else next.add(productId)'));
});

test('Product marketplace preserves cursor pagination, dedupe and locale-aware pricing', () => {
  assert.ok(page.includes('if (!hasMore || !nextCursor || loadingMore) return'));
  assert.ok(page.includes('const cursor = nextCursor'));
  assert.ok(page.includes('const ids = new Set(current.map((product) => product.id))'));
  assert.ok(page.includes('nextProducts.filter((product) => !ids.has(product.id))'));
  assert.ok(page.includes('payload.page?.next_cursor ?? null'));
  assert.ok(page.includes('new Intl.NumberFormat(locale'));
  assert.ok(page.includes("currency: product.currency || 'INR'"));
});

test('Product smart filters preserve drawer, sort and active-filter interaction contracts', () => {
  assert.ok(filters.includes("if (event.key === 'Escape')"));
  assert.ok(filters.includes("document.body.style.overflow = 'hidden'"));
  assert.ok(filters.includes("window.addEventListener('keydown', onKeyDown)"));
  assert.ok(filters.includes("Number(stock !== 'any') + Number(shop !== 'any')"));
  assert.ok(filters.includes("onStockChange('any')"));
  assert.ok(filters.includes("onShopChange('any')"));
  assert.ok(filters.includes('onSortChange(value)'));
  assert.ok(filters.includes('onClearAll'));
  assert.ok(filters.includes('aria-modal="true"'));
});

test('Product marketplace keeps finance activation out of interactive behavior', () => {
  assert.equal(page.includes("fetch('/api/orders'"), false);
  assert.equal(filters.includes('Cashfree'), false);
  assert.equal(filters.includes('payment'), false);
});
