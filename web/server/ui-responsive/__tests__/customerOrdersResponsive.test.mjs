import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [listSource, detailSource, cssSource, routeSource] = await Promise.all([
  readFile(new URL('components/order/CustomerOrdersManager.tsx', root), 'utf8'),
  readFile(new URL('components/order/CustomerOrderDetail.tsx', root), 'utf8'),
  readFile(new URL('components/order/CustomerOrders.module.css', root), 'utf8'),
  readFile(new URL('app/orders/[orderId]/page.tsx', root), 'utf8'),
]);

test('Customer orders list links each summary to a dedicated order detail route', () => {
  assert.ok(listSource.includes("import styles from './CustomerOrders.module.css'"));
  assert.ok(listSource.includes('View order details'));
  assert.ok(listSource.includes('href={`/orders/${encodeURIComponent(order.id)}`}'));
  assert.ok(listSource.includes('styles.summaryGrid'));
  assert.ok(listSource.includes('styles.orderActions'));
});

test('Customer orders empty state stays compact and CTA-balanced across real device widths', () => {
  assert.ok(listSource.includes('styles.emptyOrdersCard'));
  assert.ok(listSource.includes('styles.emptyOrdersState'));
  assert.ok(listSource.includes('styles.emptyOrdersActions'));
  assert.ok(cssSource.includes('.emptyOrdersState :global(.state-panel)'));
  assert.ok(cssSource.includes('min-height: 0'));
  assert.ok(cssSource.includes('justify-content: center'));
  assert.ok(cssSource.includes('@media (max-width: 760px)'));
  assert.ok(cssSource.includes('.emptyOrdersActions :global(.button)'));
  assert.ok(cssSource.includes('width: 100%'));
  assert.ok(cssSource.includes('@media (max-width: 480px)'));
  assert.ok(cssSource.includes('.emptyOrdersState :global(.state-mark)'));
});

test('Customer order detail route renders the scoped detail component', () => {
  assert.ok(routeSource.includes("CustomerOrderDetail from '../../../components/order/CustomerOrderDetail'"));
  assert.ok(routeSource.includes('CustomerOrderDetail orderId={orderId}'));
  assert.ok(detailSource.includes("fetch('/api/orders', { cache: 'no-store' })"));
  assert.ok(detailSource.includes('styles.detailLayout'));
  assert.ok(detailSource.includes('styles.detailAside'));
  assert.ok(detailSource.includes('styles.timeline'));
});

test('Customer order responsive layout stacks actions and values safely on mobile', () => {
  assert.ok(cssSource.includes('@media (max-width: 760px)'));
  assert.ok(cssSource.includes('.detailAside'));
  assert.ok(cssSource.includes('order: -1'));
  assert.ok(cssSource.includes('.orderActions :global(.button)'));
  assert.ok(cssSource.includes('width: 100%'));
  assert.ok(cssSource.includes('.infoRow'));
  assert.ok(cssSource.includes('grid-template-columns: 1fr'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('overflow-x: clip'));
});

test('Customer order journey keeps non-payment boundaries explicit', () => {
  assert.ok(detailSource.includes('non-payment order-request flow'));
  assert.ok(detailSource.includes('TakeItEsee payment and Cashfree are not active for this order'));
  assert.ok(listSource.includes('non-payment order requests'));
});
