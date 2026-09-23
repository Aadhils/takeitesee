import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mobileRoot = new URL('../', import.meta.url);
const repoRoot = new URL('../', mobileRoot);

const [bookingsClient, customerDetail, customerAttendanceRoute, completionNotification] = await Promise.all([
  readFile(new URL('lib/bookings.ts', mobileRoot), 'utf8'),
  readFile(new URL('app/bookings/[bookingId].tsx', mobileRoot), 'utf8'),
  readFile(new URL('web/app/api/bookings/[bookingId]/attendance/route.ts', repoRoot), 'utf8'),
  readFile(new URL('web/database/migrations/20260829_phase12_completion_confirmation_notification.sql', repoRoot), 'utf8'),
]);

test('native Customer completion uses only confirm_completion through the frozen attendance route', () => {
  assert.ok(bookingsClient.includes('confirmCustomerServiceCompletion'));
  assert.ok(bookingsClient.includes('`/api/bookings/${encodeURIComponent(bookingId)}/attendance`'));
  assert.ok(bookingsClient.includes("method: 'POST'"));
  assert.ok(bookingsClient.includes('accessToken'));
  assert.ok(bookingsClient.includes("body: JSON.stringify({ action: 'confirm_completion' })"));
  assert.ok(!bookingsClient.includes("action: 'report_provider_no_show'"));
});

test('Customer completion UI is bounded by server-derived completed closeout state and requires confirmation', () => {
  assert.ok(customerDetail.includes("booking.status === 'completed'"));
  assert.ok(customerDetail.includes("booking.attendance_outcome === 'service_completed'"));
  assert.ok(customerDetail.includes("booking.closeout_state === 'awaiting_customer'"));
  assert.ok(customerDetail.includes('Confirm service completed'));
  assert.ok(customerDetail.includes('Confirm completion?'));
  assert.ok(customerDetail.includes('completionConfirmOpen'));
  assert.ok(customerDetail.includes('confirmCustomerServiceCompletion'));
  assert.ok(customerDetail.includes('fetchCustomerBooking(bookingId)'));
  assert.ok(customerDetail.includes('The server verifies booking ownership and completion state'));
  assert.ok(customerDetail.includes('this action does not collect payment or complete the booking from the Provider side'));
  assert.ok(!customerDetail.includes('report_provider_no_show'));
  assert.ok(!customerDetail.includes("submitAction('complete')"));
});

test('existing Customer attendance endpoint and completion RPC remain server-authoritative and duplicate-safe', () => {
  assert.ok(customerAttendanceRoute.includes('productionAuthProvider.requireCustomer(request)'));
  assert.ok(customerAttendanceRoute.includes('createSupabaseServerClient(request)'));
  assert.ok(customerAttendanceRoute.includes("body.action === 'confirm_completion'"));
  assert.ok(customerAttendanceRoute.includes("supabase.rpc('customer_confirm_service_completion'"));

  assert.ok(completionNotification.includes("b.status<>'completed'"));
  assert.ok(completionNotification.includes("raise exception 'Only your completed booking can be confirmed.'"));
  assert.ok(completionNotification.includes('if c.customer_completion_confirmed_at is not null then return c; end if;'));
  assert.ok(completionNotification.includes("values(provider_user_id,b.id,'completion_confirmed'"));
});

test('Customer completion slice does not add support, finance, closeout-control, recovery or Provider completion routes', () => {
  const slice = `${bookingsClient}\n${customerDetail}`.toLowerCase();
  for (const forbidden of [
    '/closeout',
    '/checkout',
    '/api/payments',
    '/api/cashfree',
    '/refund',
    '/payout',
    '/settlement',
    '/reconciliation',
    '/recovery',
    'cash collection',
    'cash-collection',
    'requirementoccurrencerecoverypanel',
  ]) {
    assert.ok(!slice.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
  assert.ok(!bookingsClient.includes('/support'));
  assert.ok(!customerDetail.includes("pathname: '/support"));
  assert.ok(!customerDetail.includes('href="/support'));
  assert.ok(!bookingsClient.includes("ProviderBookingAction = 'accept' | 'decline' | 'complete'"));
});
