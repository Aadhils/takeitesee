import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [attention, translations] = await Promise.all([
  readFile(new URL('components/account/CustomerProductOrderAttention.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'account.productOrderAttention.aria',
  'account.productOrderAttention.eyebrow',
  'account.productOrderAttention.title',
  'account.productOrderAttention.newUpdate',
  'account.productOrderAttention.newUpdates',
  'account.productOrderAttention.reviewLatest',
  'account.productOrderAttention.allOrders',
];

test('Customer Product Order attention uses shared identity-workspace localization', () => {
  assert.ok(attention.includes('useIdentityWorkspaceTranslations'));
  assert.ok(attention.includes('const { locale, t } = useIdentityWorkspaceTranslations()'));
  assert.ok(!attention.includes('const tamil ='));
  assert.ok(!attention.includes('tamil ?'));
  assert.ok(!/[஀-௿]/u.test(attention));
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
    assert.ok(attention.includes("t('" + key + "')"));
  }
});

test('Customer Product Order attention preserves unread discovery and polling', () => {
  assert.ok(attention.includes("fetch('/api/notifications?mode=product-order-unread-updates'"));
  assert.ok(attention.includes('Math.max(0, payload.unread_count ?? 0)'));
  assert.ok(attention.includes('setLatest(payload.latest ?? null)'));
  assert.ok(attention.includes('onUnreadChange?.(count)'));
  assert.ok(attention.includes('window.setInterval(refresh, 60_000)'));
  assert.ok(attention.includes("window.addEventListener('customer-product-order-attention-refresh', refresh)"));
});

test('Customer Product Order attention preserves safe deep-link and scoped acknowledgement', () => {
  assert.ok(attention.includes("latest.target_path?.startsWith('/orders/') ? latest.target_path : '/orders'"));
  assert.ok(attention.includes("safeTarget.match(/^\\/orders\\/([0-9a-f-]+)$/i)"));
  assert.ok(attention.includes("method: 'PATCH'"));
  assert.ok(attention.includes("headers: { 'Content-Type': 'application/json' }"));
  assert.ok(attention.includes('mark_product_order_updates_read: true'));
  assert.ok(attention.includes('order_id: orderMatch[1]'));
  assert.ok(attention.includes("window.dispatchEvent(new Event('customer-product-order-attention-refresh'))"));
  assert.ok(attention.includes('router.push(safeTarget)'));
});

test('Customer Product Order attention preserves event tone, date formatting and mobile behavior', () => {
  assert.ok(attention.includes("eventType === 'product_order_fulfilled'"));
  assert.ok(attention.includes("eventType === 'product_order_accepted'"));
  assert.ok(attention.includes("new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })"));
  assert.ok(attention.includes("count > 99 ? '99+' : String(count)"));
  assert.ok(attention.includes('@media (max-width: 720px)'));
  assert.ok(attention.includes('grid-template-columns: 1fr'));
  assert.ok(attention.includes('width: 100%'));
  assert.ok(!attention.includes('Cashfree'));
  assert.ok(!attention.includes('/api/pay'));
});
