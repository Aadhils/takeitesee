import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [listSource, detailSource, cssSource, routeSource, translationsSource] = await Promise.all([
  readFile(new URL('components/provider/ProviderOrdersManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderOrderDetail.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderOrders.module.css', root), 'utf8'),
  readFile(new URL('app/provider/orders/[orderId]/page.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

test('Business product orders use a compact lifecycle inbox', () => {
  assert.ok(listSource.includes("type OrderView = 'new' | 'accepted' | 'fulfilled' | 'closed'"));
  assert.ok(listSource.includes("status === 'requested'"));
  assert.ok(listSource.includes("status === 'declined' || status === 'cancelled'"));
  assert.ok(listSource.includes('styles.lifecycleSummary'));
  assert.ok(listSource.includes('styles.lifecycleButtonActive'));
  assert.ok(listSource.includes('aria-pressed={view === item.key}'));
  assert.ok(listSource.includes('visibleOrders.map((order)'));
  assert.ok(cssSource.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'));
});

test('Business order summaries route to a dedicated provider detail page', () => {
  assert.ok(listSource.includes('href={`/provider/orders/${encodeURIComponent(order.id)}`}'));
  assert.ok(listSource.includes("t('provider.orders.viewDetails')"));
  assert.ok(routeSource.includes("ProviderOrderDetail from '../../../../components/provider/ProviderOrderDetail'"));
  assert.ok(routeSource.includes('ProviderOrderDetail orderId={orderId}'));
  assert.ok(detailSource.includes("fetch('/api/provider/orders', { cache: 'no-store' })"));
});

test('Business order detail preserves provider transition semantics', () => {
  assert.ok(detailSource.includes("type OrderAction = 'accept' | 'decline' | 'fulfill'"));
  assert.ok(detailSource.includes('fetch(`/api/provider/orders/${encodeURIComponent(order.id)}`'));
  assert.ok(detailSource.includes("method: 'PATCH'"));
  assert.ok(detailSource.includes("action === 'decline' && note.trim().length < 3"));
  assert.ok(detailSource.includes("transition('accept')"));
  assert.ok(detailSource.includes("transition('decline')"));
  assert.ok(detailSource.includes("transition('fulfill')"));
  assert.ok(detailSource.includes("t('provider.orders.messageCustomer')"));
});

test('Business order detail is responsive and action-first on mobile', () => {
  assert.ok(cssSource.includes('@media (max-width: 760px)'));
  assert.ok(cssSource.includes('.detailLayout'));
  assert.ok(cssSource.includes('.detailAside'));
  assert.ok(cssSource.includes('order: -1'));
  assert.ok(cssSource.includes('.orderActions :global(.button)'));
  assert.ok(cssSource.includes('.detailActions :global(.button)'));
  assert.ok(cssSource.includes('width: 100%'));
  assert.ok(cssSource.includes('.infoRow'));
  assert.ok(cssSource.includes('grid-template-columns: 1fr'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('overflow-x: clip'));
});

test('Business product order journey keeps the non-payment boundary explicit', () => {
  assert.ok(listSource.includes("t('provider.orders.intro')"));
  assert.ok(detailSource.includes("t('provider.orders.flowNotice')"));
  assert.ok(translationsSource.includes('Payment and Cashfree are not active here'));
  assert.ok(translationsSource.includes('TakeItEsee payment and Cashfree are not active for this order'));
  assert.ok(translationsSource.includes('Payment/Cashfree இங்கு செயல்படாது.'));
  assert.ok(translationsSource.includes('TakeItEsee payment/Cashfree இந்த order-ல் செயல்படாது.'));
});
