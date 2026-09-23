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

test('native bookings client preserves authenticated Customer and bounded Provider actions', () => {
  assert.ok(bookingsClient.includes("'/api/bookings'"));
  assert.ok(bookingsClient.includes('`/api/bookings/${encodeURIComponent(bookingId)}`'));
  assert.ok(bookingsClient.includes('`/api/bookings/${encodeURIComponent(bookingId)}/availability`'));
  assert.ok(bookingsClient.includes("'/api/provider/bookings'"));
  assert.ok(bookingsClient.includes('`/api/provider/bookings/${encodeURIComponent(bookingId)}`'));
  assert.ok(bookingsClient.includes('`/api/provider/bookings/${encodeURIComponent(bookingId)}/attendance`'));
  assert.equal((bookingsClient.match(/method: 'GET'/g) ?? []).length, 5);
  assert.equal((bookingsClient.match(/method: 'PATCH'/g) ?? []).length, 3);
  assert.equal((bookingsClient.match(/method: 'POST'/g) ?? []).length, 1);
  assert.ok(bookingsClient.includes('accessToken'));
  assert.ok(bookingsClient.includes('supabase.auth.getSession()'));
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

test('Provider booking journey is role-gated and exposes accept, decline and bounded attendance only', () => {
  assert.ok(providerList.includes("roles.includes('professional')"));
  assert.ok(providerList.includes("roles.includes('business_owner')"));
  assert.ok(providerList.includes('fetchProviderBookings'));
  assert.ok(providerDetail.includes('fetchProviderBooking'));
  assert.ok(providerDetail.includes('booking.history'));
  assert.ok(providerDetail.includes("['pending', 'rescheduled'].includes(booking.status)"));
  assert.ok(providerDetail.includes("submitAction('accept')"));
  assert.ok(providerDetail.includes("submitAction('decline')"));
  assert.ok(providerDetail.includes('declineReason.trim().length < 3'));
  assert.ok(providerDetail.includes('reportProviderCustomerNoShow'));
  assert.ok(providerDetail.includes("booking.status === 'confirmed' && booking.attendance_outcome === 'pending'"));
  assert.ok(providerDetail.includes('Confirm no-show'));
  assert.ok(providerDetail.includes('Server-authoritative Provider journey'));
  assert.ok(bookingsClient.includes("export type ProviderBookingAction = 'accept' | 'decline';"));
  assert.ok(bookingsClient.includes("action === 'decline'"));
  assert.ok(bookingsClient.includes("action: 'report_customer_no_show'"));
  assert.ok(!providerDetail.includes("submitAction('complete')"));
  assert.ok(!bookingsClient.includes("ProviderBookingAction = 'accept' | 'decline' | 'complete'"));
  assert.ok(!providerDetail.includes('cancelCustomerBooking'));
  assert.ok(!providerDetail.includes('rescheduleCustomerBooking'));
});

test('Customer Home and Provider workspace expose focused booking entries', () => {
  assert.ok(home.includes('href="/bookings"'));
  assert.ok(home.includes('My bookings'));
  assert.ok(providerWorkspace.includes('href="/provider-bookings"'));
  assert.ok(providerWorkspace.includes('Provider bookings'));
});

test('native booking actions keep attendance bounded and stay outside finance, closeout controls, completion, recovery and job routes', () => {
  const lower = bookingSlice.toLowerCase();
  for (const forbidden of [
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
  assert.equal((bookingSlice.match(/\/attendance/g) ?? []).length, 1);
  assert.ok(bookingsClient.includes('`/api/provider/bookings/${encodeURIComponent(bookingId)}/attendance`'));
  assert.ok(!bookingsClient.includes('`/api/bookings/${encodeURIComponent(bookingId)}/attendance`'));
  assert.ok(!bookingsClient.includes("action: 'confirm_completion'"));
  assert.ok(!bookingsClient.includes("action: 'report_provider_no_show'"));
});
