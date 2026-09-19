import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [pageSource, shellSource, styles] = await Promise.all([
  readFile(new URL('app/products/[productId]/page.tsx', root), 'utf8'),
  readFile(new URL('app/products/[productId]/ProductDetailShell.tsx', root), 'utf8'),
  readFile(new URL('app/products/[productId]/ProductDetailPage.module.css', root), 'utf8'),
]);

test('Product detail keeps existing public actions and order-request composition', () => {
  assert.ok(pageSource.includes('<ProductDetailShell'));
  assert.ok(shellSource.includes('<SavedProductAction productId={productId} />'));
  assert.ok(shellSource.includes('<ProductShareAction'));
  assert.ok(pageSource.includes('<BusinessShopPublicStatus businessId={product.business_id} />'));
  assert.ok(pageSource.includes('<BusinessStorefrontProducts products={['));
  assert.ok(pageSource.includes('stock_mode: product.stock_mode'));
});

test('Product detail long public text wraps safely', () => {
  assert.ok(styles.includes('.intro h1'));
  assert.ok(styles.includes('.description'));
  assert.ok(styles.includes('.sellerLine'));
  assert.ok(styles.includes('overflow-wrap: anywhere'));
  assert.ok(styles.includes('word-break: break-word'));
});

test('Product detail actions remain touch-friendly and stack on mobile', () => {
  assert.ok(styles.includes('min-height: 44px'));
  assert.ok(styles.includes('@media (max-width: 640px)'));
  assert.ok(styles.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
  assert.ok(styles.includes('.ctaRow'));
  assert.ok(styles.includes('grid-template-columns: 1fr'));
  assert.ok(styles.includes('@media (max-width: 390px)'));
});

test('Product detail remains presentation-only around order flow', () => {
  assert.equal(pageSource.includes("fetch('/api/orders'"), false);
  assert.equal(shellSource.includes("fetch('/api/orders'"), false);
  assert.equal(pageSource.includes('payment_status'), false);
  assert.equal(shellSource.includes('payment_status'), false);
  assert.equal(pageSource.includes('Cashfree'), false);
  assert.equal(shellSource.includes('Cashfree'), false);
  assert.ok(pageSource.includes('non-payment order request'));
});
