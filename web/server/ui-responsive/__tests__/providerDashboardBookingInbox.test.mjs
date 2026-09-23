import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [entrySource, inboxSource, cssSource, bookingApiSource] = await Promise.all([
  readFile(new URL('components/provider/ProviderDashboardEntry.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardBookingInbox.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardBookingInbox.module.css', root), 'utf8'),
  readFile(new URL('app/api/provider/bookings/route.ts', root), 'utf8'),
]);

test('Provider Dashboard surfaces a compact booking next-action inbox', () => {
  assert.ok(entrySource.includes('ProviderDashboardBookingInbox'));
  assert.ok(inboxSource.includes('id="provider-booking-inbox"'));
  assert.ok(inboxSource.includes("fetch('/api/provider/bookings', { cache: 'no-store' })"));
  assert.ok(inboxSource.includes('MAX_ATTENTION_ITEMS = 3'));
});

test('booking inbox prioritizes real operational next actions without mutating bookings', () => {
  assert.ok(inboxSource.includes("booking.status === 'pending' || booking.status === 'rescheduled'"));
  assert.ok(inboxSource.includes("booking.status === 'confirmed'"));
  assert.ok(inboxSource.includes("booking.closeout_state === 'support_open'"));
  assert.ok(inboxSource.includes('href={`/provider/bookings/${booking.id}`}'));
  assert.ok(!inboxSource.includes("method: 'PATCH'"));
  assert.ok(!inboxSource.includes("method: 'PUT'"));
  assert.ok(!inboxSource.includes("method: 'POST'"));
  assert.ok(bookingApiSource.includes('productionProviderBookingRepository.list(session, request)'));
});

test('booking inbox refreshes data and time when the Provider returns', () => {
  assert.ok(inboxSource.includes("t('provider.bookingInbox.refresh')"));
  assert.ok(inboxSource.includes('setNow(Date.now())'));
  assert.ok(inboxSource.includes("window.addEventListener('focus', refreshVisibleInbox)"));
  assert.ok(inboxSource.includes("document.addEventListener('visibilitychange', refreshVisibleInbox)"));
  assert.ok(inboxSource.includes('if (loadingRef.current) return;'));
});

test('booking inbox remains compact and responsive', () => {
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('@media (max-width: 640px)'));
  assert.ok(cssSource.includes('@media (max-width: 440px)'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
  assert.ok(cssSource.includes('.headerActions'));
});
