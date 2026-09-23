import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [
  bookingsClient,
  customerList,
  customerDetail,
  customerActions,
  providerList,
  providerDetail,
  home,
  providerWorkspace,
] = await Promise.all([
  readFile(new URL('lib/bookings.ts', root), 'utf8'),
  readFile(new URL('app/bookings.tsx', root), 'utf8'),
  readFile(new URL('app/bookings/[bookingId].tsx', root), 'utf8'),
  readFile(new URL('app/booking-actions/[bookingId].tsx', root), 'utf8'),
  readFile(new URL('app/provider-bookings.tsx', root), 'utf8'),
  readFile(new URL('app/provider-bookings/[bookingId].tsx', root), 'utf8'),
  readFile(new URL('app/home.tsx', root), 'utf8'),
  readFile(new URL('app/provider.tsx', root), 'utf8'),
]);

const bookingSlice = [bookingsClient, customerList, customerDetail, customerActions, providerList, providerDetail].join('\n');

test('native bookings client preserves authenticated Customer actions and Provider reads', () => {
  assert.ok(bookingsClient.includes("'/api/bookings'"));
  assert.ok(bookingsClient.includes('`/api/bookings/${encodeURIComponent(bookingId)}`'));
  assert.ok(bookingsClient.includes('`/api/bookings/${encodeURIComponent(bookingId)}/availability`'));
  assert.ok(bookingsClient.includes("'/api/provider/bookings'"));
  assert.ok(bookingsClient.includes('`/api/provider/bookings/${encodeURIComponent(bookingId)}`'));
  assert.equal((bookingsClient.match(/method: 'GET'/g) ?? []).length, 5);
  assert.equal((bookingsClient.match(/method: 'PATCH'/g) ?? []).length, 2);
  assert.ok(bookingsClient.includes('accessToken'));
  assert.ok(bookingsClient.includes('supabase.auth.getSession()'));
  assert.ok(!bookingsClient.includes("method: 'POST'"));
  assert.ok(!bookingsClient.includes("method: 'DELETE'"));
});

test('Customer booking detail exposes server-authoritative cancel and reschedule actions', () => {
  assert.ok(customerList.includes('fetchCustomerBookings'));
  assert.ok(customerList.includes("pathname: '/bookings/[bookingId]'"));
  assert.ok(customerDetail.includes('fetchCustomerBooking'));
  assert.ok(customerDetail.includes("pathname: '/booking-actions/[bookingId]'"));
  assert.ok(customerDetail.includes("pathname: '/providers/[providerType]/[providerId]'"));
  assert.ok(customerDetail.includes('Server-authoritative booking journey'));
  assert.ok(customerActions.includes('cancelCustomerBooking'));
  assert.ok(customerActions.includes('rescheduleCustomerBooking'));
  assert.ok(customerActions.includes('fetchCustomerBookingAvailability'));
  assert.ok(customerActions.includes('isCurrentBookingSlot'));
});

test('Customer booking action contract mirrors existing server rules without copying the state machine', () => {
  assert.ok(bookingsClient.includes("status: 'cancelled'"));
  assert.ok(bookingsClient.includes("status: 'rescheduled'"));
  assert.ok(bookingsClient.includes('bookingTimeTo24Hour'));
  assert.ok(bookingsClient.includes('normalized.length < 3'));
  assert.ok(bookingsClient.includes('normalized.length > 500'));
  assert.ok(customerActions.includes("['pending', 'confirmed', 'rescheduled'].includes(booking.status)"));
  assert.ok(customerActions.includes("['customer_no_show', 'provider_no_show'].includes"));
  assert.ok(customerActions.includes("slot.available && !isCurrentBookingSlot"));
  assert.ok(customerActions.includes("current = isCurrentBookingSlot"));
});

test('Provider booking journey remains role-gated and read-only', () => {
  assert.ok(providerList.includes("roles.includes('professional')"));
  assert.ok(providerList.includes("roles.includes('business_owner')"));
  assert.ok(providerList.includes('fetchProviderBookings'));
  assert.ok(providerDetail.includes('fetchProviderBooking'));
  assert.ok(providerDetail.includes('booking.history'));
  assert.ok(providerDetail.includes('Read-only native Provider journey'));
  assert.ok(!providerDetail.includes('transitionProviderBookingStatus'));
  assert.ok(!providerDetail.includes('cancelCustomerBooking'));
  assert.ok(!providerDetail.includes('rescheduleCustomerBooking'));
});

test('Customer Home and Provider workspace expose focused booking entries', () => {
  assert.ok(home.includes('href="/bookings"'));
  assert.ok(home.includes('My bookings'));
  assert.ok(providerWorkspace.includes('href="/provider-bookings"'));
  assert.ok(providerWorkspace.includes('Provider bookings'));
});

test('Customer booking actions stay outside finance, attendance, completion, recovery and job routes', () => {
  const lower = bookingSlice.toLowerCase();
  for (const forbidden of [
    '/attendance',
    '/closeout',
    '/checkout',
    '/api/payments',
    '/api/cashfree',
    '/recovery',
    '/job',
    'requirementoccurrencerecoverypanel',
    'payment_status',
  ]) {
    assert.ok(!lower.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
