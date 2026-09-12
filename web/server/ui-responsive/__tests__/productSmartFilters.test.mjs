import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [pageSource, filtersSource, stylesSource] = await Promise.all([
  readFile(new URL('app/products/page.tsx', root), 'utf8'),
  readFile(new URL('components/discovery/ProductSmartFilters.tsx', root), 'utf8'),
  readFile(new URL('components/discovery/ProductSmartFilters.module.css', root), 'utf8'),
]);

test('Products uses compact smart filters while preserving URL and API search semantics', () => {
  assert.ok(pageSource.includes("import ProductSmartFilters from '../../components/discovery/ProductSmartFilters'"));
  assert.ok(pageSource.includes('<ProductSmartFilters'));
  assert.equal(pageSource.includes("<Select label={tamil ? 'Stock நிலை' : 'Stock'}"), false);
  assert.equal(pageSource.includes("<Select label={tamil ? 'Sort' : 'Sort'}"), false);

  assert.ok(pageSource.includes("params.set('stock', stock)"));
  assert.ok(pageSource.includes("params.set('shop', shop)"));
  assert.ok(pageSource.includes("params.set('sort', sort)"));
  assert.ok(pageSource.includes("fetch(`/api/marketplace/products?${params.toString()}`"));
  assert.ok(pageSource.includes("const stockFilters: StockFilter[] = ['any', 'orderable', 'in_stock', 'made_to_order']"));
  assert.ok(pageSource.includes("const shopFilters: ShopFilter[] = ['any', 'open']"));
  assert.ok(pageSource.includes("const sortModes: SortMode[] = ['relevance', 'price', 'price-desc', 'name']"));
  assert.ok(pageSource.includes('TakeItEsee payment and Cashfree are not active.'));
});

test('Products smart filters provide mobile sheet and app-style sort chooser', () => {
  assert.ok(filtersSource.includes('product-smart-filters'));
  assert.ok(filtersSource.includes('id="product-filter-sheet"'));
  assert.ok(filtersSource.includes('id="product-sort-menu"'));
  assert.ok(filtersSource.includes('role="dialog"'));
  assert.ok(filtersSource.includes('aria-pressed={sort === choice.value}'));
  assert.ok(filtersSource.includes("onStockChange('any')"));
  assert.ok(filtersSource.includes("onShopChange('any')"));
  assert.ok(filtersSource.includes('copy.showResults(resultCount)'));
});

test('Products smart filters stay compact across desktop tablet and narrow phone', () => {
  assert.ok(stylesSource.includes('.desktopToolbar'));
  assert.ok(stylesSource.includes('.mobileToolbar'));
  assert.ok(stylesSource.includes('@media (max-width: 900px)'));
  assert.ok(stylesSource.includes('@media (max-width: 640px)'));
  assert.ok(stylesSource.includes('@media (max-width: 380px)'));
  assert.ok(stylesSource.includes('min-height: 44px'));
  assert.ok(stylesSource.includes('env(safe-area-inset-bottom)'));
});

test('Products hero actions stay in one swipeable compact rail on narrow phones', () => {
  assert.ok(stylesSource.includes(':global(.discovery-page:has(.product-smart-filters) > .page-intro > div)'));
  assert.ok(stylesSource.includes('flex-wrap: nowrap !important'));
  assert.ok(stylesSource.includes('overflow-x: auto'));
  assert.ok(stylesSource.includes('-webkit-overflow-scrolling: touch'));
  assert.ok(stylesSource.includes('> .page-intro > div > a)'));
  assert.ok(stylesSource.includes('white-space: nowrap'));
});
