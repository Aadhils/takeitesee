import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/order/CustomerOrdersManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/LanguageProvider.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'orders.customerEyebrow','orders.title','orders.signInIntro','orders.signInRequired','orders.signInHelp','orders.signIn',
  'orders.createAccount','orders.intro','orders.loading','orders.emptyTitle','orders.emptyHelp','orders.browseProducts',
  'orders.filterAria','orders.viewAll','orders.viewActive','orders.viewFulfilled','orders.viewClosed','orders.lifecycleMeta',
  'orders.filteredEmptyTitle','orders.filteredEmptyHelp','orders.showAll','orders.snapshotTotal','orders.requestedAt',
  'orders.revision','orders.latest','orders.viewDetails','orders.messageBusiness','orders.cancelRequest',
  'orders.status.requested','orders.status.accepted','orders.status.declined','orders.status.fulfilled','orders.status.cancelled',
  'orders.loadFallback','orders.cancelFallback',
];

test('Customer Orders list uses shared LanguageProvider localization with EN/TA parity', () => {
  assert.ok(source.includes('const { locale, t } = useLanguage()'));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Customer Orders preserves discovery, auth and anchored attention behavior', () => {
  assert.ok(source.includes("fetch('/api/orders', { cache: 'no-store' })"));
  assert.ok(source.includes('response.status === 401'));
  assert.ok(source.includes("href=\"/login?returnTo=%2Forders\""));
  assert.ok(source.includes("const targetId = window.location.hash.slice(1)"));
  assert.ok(source.includes("targetId.startsWith('order-')"));
  assert.ok(source.includes("scrollIntoView({ behavior: 'smooth', block: 'center' })"));
});

test('Customer Orders preserves exact lifecycle grouping and localized status semantics', () => {
  assert.ok(source.includes("type OrderView = 'all' | 'active' | 'fulfilled' | 'closed'"));
  assert.ok(source.includes("status === 'requested' || status === 'accepted'"));
  assert.ok(source.includes("status === 'declined' || status === 'cancelled'"));
  for (const status of ['requested','accepted','declined','fulfilled','cancelled']) {
    assert.ok(source.includes("t('orders.status." + status + "')"));
  }
  assert.ok(source.includes("t('orders.lifecycleMeta').replace('{visible}', String(visibleOrders.length)).replace('{total}', String(orders.length))"));
});

test('Customer Orders preserves cancellation, detail and Business-message actions', () => {
  assert.ok(source.includes('fetch(`/api/orders/${encodeURIComponent(orderId)}`'));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes("body: JSON.stringify({ action: 'cancel' })"));
  assert.ok(source.includes('href={`/orders/${encodeURIComponent(order.id)}`}'));
  assert.ok(source.includes('href={`/messages?conversation=${encodeURIComponent(order.conversation_id)}`}'));
  assert.ok(source.includes("order.status === 'requested' || order.status === 'accepted'"));
});

test('Customer Orders preserves locale-aware currency and timestamps', () => {
  assert.ok(source.includes("new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 })"));
  assert.ok(source.includes('new Date(order.created_at).toLocaleString(locale)'));
  assert.ok(source.includes('new Date(latestEvent.created_at).toLocaleString(locale)'));
});

test('Customer Orders localization does not activate payment behavior', () => {
  for (const term of ["fetch('/api/pay", 'createPayment', 'CashfreeClient', 'refundOrder', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
