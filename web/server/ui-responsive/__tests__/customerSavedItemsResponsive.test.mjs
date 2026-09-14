import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [servicesSource, productsSource, cssSource] = await Promise.all([
  readFile(new URL('components/account/SavedServicesPage.tsx', root), 'utf8'),
  readFile(new URL('components/account/SavedProductsPage.tsx', root), 'utf8'),
  readFile(new URL('components/account/CustomerSavedItemsResponsive.module.css', root), 'utf8'),
]);

test('Saved Services and Saved Products share the focused responsive wrapper', () => {
  for (const source of [servicesSource, productsSource]) {
    assert.ok(source.includes('CustomerSavedItemsResponsive.module.css'));
    assert.ok(source.includes('savedItemsJourney'));
    assert.ok(source.includes('LocalizedAccountShell'));
  }
  assert.ok(servicesSource.includes('active="/saved-services"'));
  assert.ok(productsSource.includes('active="/saved-products"'));
});

test('Saved Items styles cover narrow content, facts and actions', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('account-layout'));
  assert.ok(cssSource.includes('section-heading'));
  assert.ok(cssSource.includes('review-details'));
  assert.ok(cssSource.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
  assert.ok(cssSource.includes('grid-template-columns: minmax(0, 1fr)'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('max-width: 760px'));
  assert.ok(cssSource.includes('max-width: 560px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('Saved Services data and action semantics remain intact', () => {
  assert.ok(servicesSource.includes("fetch('/api/account/saved-services'"));
  assert.ok(servicesSource.includes("method: 'DELETE'"));
  assert.ok(servicesSource.includes('body: JSON.stringify({ service_id: serviceId })'));
  assert.ok(servicesSource.includes('/login?returnTo=%2Fsaved-services'));
  assert.ok(servicesSource.includes('href="/explore"'));
  assert.ok(servicesSource.includes('/services/${encodeURIComponent(service.id)}'));
  assert.ok(servicesSource.includes('!item.available || !item.service'));
});

test('Saved Products data, approval and existing empty-state semantics remain intact', () => {
  assert.ok(productsSource.includes("fetch('/api/account/saved-products'"));
  assert.ok(productsSource.includes("method: 'DELETE'"));
  assert.ok(productsSource.includes('body: JSON.stringify({ product_id: productId })'));
  assert.ok(productsSource.includes('/login?returnTo=%2Fsaved-products'));
  assert.ok(productsSource.includes('href="/products"'));
  assert.ok(productsSource.includes('/products/${encodeURIComponent(product.id)}'));
  assert.ok(productsSource.includes('!item.available || !item.product'));
  assert.ok(productsSource.includes('saved-products-empty-card'));
  assert.ok(productsSource.includes('saved-products-empty-actions'));
  assert.ok(productsSource.includes('productImageHref(product.id)'));
});
