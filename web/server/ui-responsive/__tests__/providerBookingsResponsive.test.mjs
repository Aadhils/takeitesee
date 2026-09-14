import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [listRoute, detailRoute, listSource, detailSource, cssSource] = await Promise.all([
  readFile(new URL('app/provider/bookings/page.tsx', root), 'utf8'),
  readFile(new URL('app/provider/bookings/[bookingId]/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderBookingsManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderBookingDetail.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderBookingsResponsive.module.css', root), 'utf8'),
]);

test('Provider Bookings list and detail use scoped responsive wrappers', () => {
  assert.ok(listRoute.includes('ProviderBookingsResponsive.module.css'));
  assert.ok(listRoute.includes('className={styles.bookingsJourney}'));
  assert.ok(detailRoute.includes('ProviderBookingsResponsive.module.css'));
  assert.ok(detailRoute.includes('className={styles.detailJourney}'));
});

test('Provider Bookings responsive styles protect mobile density and touch targets', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('@media (max-width: 900px)'));
  assert.ok(cssSource.includes('@media (max-width: 760px)'));
  assert.ok(cssSource.includes('@media (max-width: 560px)'));
  assert.ok(cssSource.includes('padding-bottom: calc(78px + env(safe-area-inset-bottom, 0px))'));
});

test('Provider booking facts and actions collapse safely on narrow phones', () => {
  assert.ok(cssSource.includes(':global(.provider-booking-details)'));
  assert.ok(cssSource.includes(':global(.provider-profile-details)'));
  assert.ok(cssSource.includes(':global(.provider-actions)'));
  assert.ok(cssSource.includes('grid-template-columns: minmax(0, 1fr)'));
  assert.ok(cssSource.includes('width: 100%'));
});

test('Existing Provider booking lifecycle and handoff surfaces remain present', () => {
  assert.ok(listSource.includes("fetch('/api/provider/bookings'"));
  assert.ok(listSource.includes("act(booking.id, 'accept')"));
  assert.ok(listSource.includes("act(booking.id, 'complete')"));
  assert.ok(listSource.includes('setDeclineTarget(booking)'));
  assert.ok(detailSource.includes('ProviderRequirementOccurrenceContext'));
  assert.ok(detailSource.includes('ProviderCashCollectionPanel'));
  assert.ok(detailSource.includes('BookingCloseoutPanel'));
  assert.ok(detailSource.includes('BookingAuditTimeline'));
});
