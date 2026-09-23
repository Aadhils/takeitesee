import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mobileRoot = new URL('../', import.meta.url);
const repoRoot = new URL('../', mobileRoot);

const [bookingsClient, providerDetail, providerAttendanceRoute, attendanceHardening] = await Promise.all([
  readFile(new URL('lib/bookings.ts', mobileRoot), 'utf8'),
  readFile(new URL('app/provider-bookings/[bookingId].tsx', mobileRoot), 'utf8'),
  readFile(new URL('web/app/api/provider/bookings/[bookingId]/attendance/route.ts', repoRoot), 'utf8'),
  readFile(new URL('web/database/migrations/20260829_phase12_closeout_sla_hardening.sql', repoRoot), 'utf8'),
]);

test('native Provider attendance exposes only customer no-show through the frozen server route', () => {
  assert.ok(bookingsClient.includes('reportProviderCustomerNoShow'));
  assert.ok(bookingsClient.includes('`/api/provider/bookings/${encodeURIComponent(bookingId)}/attendance`'));
  assert.ok(bookingsClient.includes("method: 'POST'"));
  assert.ok(bookingsClient.includes('accessToken'));
  assert.ok(bookingsClient.includes("action: 'report_customer_no_show'"));
  assert.ok(bookingsClient.includes('normalized.length > 1000'));
  assert.ok(!bookingsClient.includes("action: 'confirm_completion'"));
  assert.ok(!bookingsClient.includes("action: 'report_provider_no_show'"));
  assert.ok(!bookingsClient.includes('`/api/bookings/${encodeURIComponent(bookingId)}/attendance`'));
});

test('Provider attendance UI is confirmed, narrow and does not implement the grace-period state machine', () => {
  assert.ok(providerDetail.includes("booking.status === 'confirmed' && booking.attendance_outcome === 'pending'"));
  assert.ok(providerDetail.includes('Report customer no-show'));
  assert.ok(providerDetail.includes('Confirm no-show'));
  assert.ok(providerDetail.includes('attendanceConfirmOpen'));
  assert.ok(providerDetail.includes('maxLength={1000}'));
  assert.ok(providerDetail.includes('The server verifies Provider ownership, the no-show grace period'));
  assert.ok(providerDetail.includes('it does not complete the booking or collect payment'));
  assert.ok(!providerDetail.includes('no_show_grace_minutes'));
  assert.ok(!providerDetail.includes("submitAction('complete')"));
  assert.ok(!providerDetail.includes('confirm_completion'));
  assert.ok(!providerDetail.includes('report_provider_no_show'));
});

test('existing Provider attendance endpoint keeps ownership, outcome and grace checks server-authoritative', () => {
  assert.ok(providerAttendanceRoute.includes('productionAuthProvider.requireProvider(request)'));
  assert.ok(providerAttendanceRoute.includes('createSupabaseServerClient(request)'));
  assert.ok(providerAttendanceRoute.includes("body.action !== 'report_customer_no_show'"));
  assert.ok(providerAttendanceRoute.includes('note.length > 1000'));
  assert.ok(providerAttendanceRoute.includes("supabase.rpc('provider_report_customer_no_show'"));

  assert.ok(attendanceHardening.includes("b.status<>'confirmed'"));
  assert.ok(attendanceHardening.includes("raise exception 'Booking is not owned by this provider.'"));
  assert.ok(attendanceHardening.includes("existing_outcome<>'pending'"));
  assert.ok(attendanceHardening.includes("raise exception 'The no-show grace period has not ended.'"));
});

test('Provider attendance slice does not add finance, closeout-control, recovery or cash-collection routes', () => {
  const slice = `${bookingsClient}\n${providerDetail}`.toLowerCase();
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
});
