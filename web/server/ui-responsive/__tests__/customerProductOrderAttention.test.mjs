import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [notificationsRoute, attentionSource, accountSource, accountShellSource, detailSource] = await Promise.all([
  readFile(new URL('app/api/notifications/route.ts', root), 'utf8'),
  readFile(new URL('components/account/CustomerProductOrderAttention.tsx', root), 'utf8'),
  readFile(new URL('components/account/AuthenticatedAccount.tsx', root), 'utf8'),
  readFile(new URL('components/account/LocalizedAccountShell.tsx', root), 'utf8'),
  readFile(new URL('components/order/CustomerOrderDetail.tsx', root), 'utf8'),
]);

test('notifications API exposes unread Customer Product Order lifecycle updates only', () => {
  assert.ok(notificationsRoute.includes("mode') === 'product-order-unread-updates'"));
  assert.ok(notificationsRoute.includes("'product_order_accepted', 'product_order_declined', 'product_order_fulfilled'"));
  assert.ok(notificationsRoute.includes(".like('target_path', '/orders/%')"));
  assert.ok(notificationsRoute.includes('unread_count: countResult.count ?? 0'));
  assert.ok(notificationsRoute.includes('latest: latestResult.data?.[0] ?? null'));
});

test('Customer Product Order updates can be acknowledged by exact order detail path', () => {
  assert.ok(notificationsRoute.includes('mark_product_order_updates_read?: boolean'));
  assert.ok(notificationsRoute.includes('order_id?: string'));
  assert.ok(notificationsRoute.includes(".eq('target_path', `/orders/${orderId}`)"));
  assert.ok(detailSource.includes('mark_product_order_updates_read: true'));
  assert.ok(detailSource.includes("window.dispatchEvent(new Event('customer-product-order-attention-refresh'))"));
});

test('Customer account surfaces Product Order attention in content and account navigation', () => {
  assert.ok(accountSource.includes("CustomerProductOrderAttention from './CustomerProductOrderAttention'"));
  assert.ok(accountSource.includes('productOrderUnreadCount'));
  assert.ok(accountSource.includes('<CustomerProductOrderAttention onUnreadChange={setProductOrderUnreadCount} />'));
  assert.ok(accountSource.includes("href: '/orders'"));
  assert.ok(accountSource.includes('customer-account-action-badge'));
  assert.ok(accountShellSource.includes("href: '/orders'"));
  assert.ok(accountShellSource.includes('productOrderBadge'));
  assert.ok(accountShellSource.includes("fetch('/api/notifications?mode=product-order-unread-updates'"));
});

test('Customer Product Order attention deep-links latest update and refreshes live', () => {
  assert.ok(attentionSource.includes("fetch('/api/notifications?mode=product-order-unread-updates'"));
  assert.ok(attentionSource.includes("latest.target_path?.startsWith('/orders/')"));
  assert.ok(attentionSource.includes("safeTarget.match(/^\\/orders\\/([0-9a-f-]+)$/i)"));
  assert.ok(attentionSource.includes("t('account.productOrderAttention.reviewLatest')"));
  assert.ok(attentionSource.includes('window.setInterval(refresh, 60_000)'));
  assert.ok(attentionSource.includes("window.addEventListener('customer-product-order-attention-refresh', refresh)"));
  assert.ok(accountShellSource.includes('window.setInterval(refresh, 60_000)'));
});

test('Customer Product Order attention remains compact on mobile and keeps payment boundaries unchanged', () => {
  assert.ok(attentionSource.includes('@media (max-width: 720px)'));
  assert.ok(attentionSource.includes('grid-template-columns: 1fr'));
  assert.ok(attentionSource.includes('width: 100%'));
  assert.ok(detailSource.includes('non-payment order-request flow'));
  assert.ok(detailSource.includes('TakeItEsee payment and Cashfree are not active for this order'));
});
