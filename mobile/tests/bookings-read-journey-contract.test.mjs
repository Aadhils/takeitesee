import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [
  bookingsClient,
  customerList,
  customerDetail,
  providerList,
  providerDetail,
  home,
  providerWorkspace,
] = await Promise.all([
  readFile(new URL('lib/bookings.ts', root), 'utf8'),
  readFile(new URL('app/bookings.tsx', root), 'utf8'),
  readFile(new URL('app/bookings/[bookingId].tsx', root), 'utf8'),
  readFile(new URL('app/provider-bookings.tsx', root), 'utf8'),
  readFile(new URL('app/provider-bookings/[bookingId].tsx', root), 'utf8'),
  readFile(new URL('app/home.tsx', root), 'utf8'),
  readFile(new URL('app/provider.tsx', root), 'utf8'),
]);

const bookingSlice = [bookingsClient, customerList, customerDetail, providerList, providerDetail].join('\n');

test('native bookings client is authenticated and GET-only for Customer and Provider journeys', () => {
  assert.ok(bookingsClient.includes("'/api/bookings'"));
  assert.ok(bookingsClient.includes('`/api/bookings/${encodeURIComponent(bookingId)}`'));
  assert.ok(bookingsClient.includes("'/api/provider/bookings'"));
  assert.ok(bookingsClient.includes('`/api/provider/bookings/${encodeURIComponent(bookingId)}`'));
  assert.equal((bookingsClient.match(/method: 'GET'/g) ?? []).length, 4);
  assert.ok(bookingsClient.includes('accessToken'));
  assert.ok(bookingsClient.includes('supabase.auth.getSession()'));
  assert.ok(!bookingsClient.includes("method: 'PATCH'"));
  assert.ok(!bookingsClient.includes("method: 'POST'"));
  assert.ok(!bookingsClient.includes("method: 'DELETE'"));
});

test('Customer booking journey exposes list/detail reads without mutation controls', () => {
  assert.ok(customerList.includes('fetchCustomerBookings'));
  assert.ok(customerList.includes("pathname: '/bookings/[bookingId]'"));
  assert.ok(customerDetail.includes('fetchCustomerBooking'));
  assert.ok(customerDetail.includes("pathname: '/providers/[providerType]/[providerId]'"));
  assert.ok(customerDetail.includes('Read-only native journey'));
  assert.ok(!customerList.includes('cancelBooking'));
  assert.ok(!customerDetail.includes('rescheduleBooking'));
});

test('Provider booking journey is role-gated and read-only', () => {
  assert.ok(providerList.includes("roles.includes('professional')"));
  assert.ok(providerList.includes("roles.includes('business_owner')"));
  assert.ok(providerList.includes('fetchProviderBookings'));
  assert.ok(providerDetail.includes('fetchProviderBooking'));
  assert.ok(providerDetail.includes('booking.history'));
  assert.ok(providerDetail.includes('Read-only native Provider journey'));
  assert.ok(!providerDetail.includes('transitionProviderBookingStatus'));
});

test('Customer Home and Provider workspace expose focused booking entries', () => {
  assert.ok(home.includes('href="/bookings"'));
  assert.ok(home.includes('My bookings'));
  assert.ok(providerWorkspace.includes('href="/provider-bookings"'));
  assert.ok(providerWorkspace.includes('Provider bookings'));
});

test('bookings read slice stays outside finance, recurrence recovery and job action routes', () => {
  const lower = bookingSlice.toLowerCase();
  for (const forbidden of [
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
