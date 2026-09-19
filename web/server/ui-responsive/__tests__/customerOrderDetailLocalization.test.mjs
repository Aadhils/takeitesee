import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/order/CustomerOrderDetail.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/LanguageProvider.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const detailKeys = [
  'orders.detail.productOrder','orders.detail.signInHelp','orders.detail.backToOrders','orders.detail.loading',
  'orders.detail.notFoundTitle','orders.detail.notFoundHelp','orders.detail.myOrders','orders.detail.requestLabel',
  'orders.detail.informationEyebrow','orders.detail.snapshotTitle','orders.detail.business','orders.detail.quantity',
  'orders.detail.unitPrice','orders.detail.statusUpdated','orders.detail.productRevision','orders.detail.notesEyebrow',
  'orders.detail.notesTitle','orders.detail.yourNote','orders.detail.businessNote','orders.detail.activityEyebrow',
  'orders.detail.timelineTitle','orders.detail.event.requested','orders.detail.event.accepted','orders.detail.event.declined',
  'orders.detail.event.fulfilled','orders.detail.event.cancelled','orders.detail.actor.customer','orders.detail.actor.business',
  'orders.detail.actor.system','orders.detail.noActivityTitle','orders.detail.noActivityHelp','orders.detail.actionsEyebrow',
  'orders.detail.flowNotice','orders.detail.loadFallback',
];

test('Customer Order Detail uses shared localization with EN/TA parity', () => {
  assert.ok(source.includes('const { locale, t } = useLanguage()'));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  for (const key of detailKeys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Customer Order Detail reuses shared Customer Orders status and action copy', () => {
  for (const key of [
    'orders.status.requested','orders.status.accepted','orders.status.declined','orders.status.fulfilled','orders.status.cancelled',
    'orders.signInRequired','orders.signIn','orders.snapshotTotal','orders.requestedAt','orders.messageBusiness','orders.cancelRequest','orders.cancelFallback',
  ]) assert.ok(source.includes("'" + key + "'"), key);
});

test('Customer Order Detail preserves exact order discovery and attention acknowledgement', () => {
  assert.ok(source.includes("fetch('/api/orders', { cache: 'no-store' })"));
  assert.ok(source.includes('candidate.id === orderId'));
  assert.ok(source.includes("fetch('/api/notifications',"));
  assert.ok(source.includes('mark_product_order_updates_read: true'));
  assert.ok(source.includes('order_id: match.id'));
  assert.ok(source.includes("window.dispatchEvent(new Event('customer-product-order-attention-refresh'))"));
});

test('Customer Order Detail preserves cancellation and conversation actions', () => {
  assert.ok(source.includes('fetch(`/api/orders/${encodeURIComponent(order.id)}`'));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes("body: JSON.stringify({ action: 'cancel' })"));
  assert.ok(source.includes("order?.status === 'requested' || order?.status === 'accepted'"));
  assert.ok(source.includes('href={`/messages?conversation=${encodeURIComponent(order.conversation_id)}`}'));
});

test('Customer Order Detail preserves locale-aware money and timestamps', () => {
  assert.ok(source.includes("new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 })"));
  assert.ok(source.includes('new Date(order.created_at).toLocaleString(locale)'));
  assert.ok(source.includes('new Date(order.status_changed_at).toLocaleString(locale)'));
  assert.ok(source.includes('new Date(event.created_at).toLocaleString(locale)'));
});

test('Customer Order Detail keeps non-payment boundary explicit without activating finance', () => {
  assert.ok(source.includes("t('orders.detail.flowNotice')"));
  assert.ok(translations.includes("'orders.detail.flowNotice': 'This is a non-payment order-request flow. TakeItEsee payment and Cashfree are not active for this order.'"));
  for (const term of ["fetch('/api/pay", 'createPayment', 'CashfreeClient', 'refundOrder', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
