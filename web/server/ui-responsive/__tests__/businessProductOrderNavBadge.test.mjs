import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [contextSource, shellSource, detailSource] = await Promise.all([
  readFile(new URL('app/api/provider/context/route.ts', root), 'utf8'),
  readFile(new URL('components/provider/LiveProviderShell.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderOrderDetail.tsx', root), 'utf8'),
]);

test('Business provider context exposes only requested Product Orders as nav attention', () => {
  assert.ok(contextSource.includes("supabase.from('business_product_orders').select('id', { count: 'exact', head: true })"));
  assert.ok(contextSource.includes(".eq('business_id', business.id)"));
  assert.ok(contextSource.includes(".eq('status', 'requested')"));
  assert.ok(contextSource.includes('requested_product_order_count: requestedProductOrderCount ?? 0'));
  assert.ok(contextSource.includes('requested_product_order_count: 0'));
});

test('Provider shell renders requested Product Order attention on desktop and mobile Business navigation', () => {
  assert.ok(shellSource.includes('requested_product_order_count: number'));
  assert.ok(shellSource.includes("link.href === '/provider/orders' && requestedProductOrders > 0"));
  assert.ok(shellSource.includes('<span className="provider-nav-count">{countLabel(requestedProductOrders)}</span>'));
  assert.ok(shellSource.includes('.provider-mobile-more-grid .provider-nav-count'));
});

test('Business Product Order badge refreshes without changing order lifecycle semantics', () => {
  assert.ok(shellSource.includes("window.addEventListener('provider-product-orders-refresh', refresh)"));
  assert.ok(shellSource.includes('window.setInterval(refresh, 60_000)'));
  assert.ok(shellSource.includes("document.addEventListener('visibilitychange', visibilityRefresh)"));
  assert.ok(detailSource.includes("window.dispatchEvent(new Event('provider-product-orders-refresh'))"));
  assert.ok(detailSource.includes("type OrderAction = 'accept' | 'decline' | 'fulfill'"));
});
