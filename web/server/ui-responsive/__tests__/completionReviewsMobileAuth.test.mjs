import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [customerAttendance, providerAttendance, closeoutRoute, closeoutSource, customerReviews, providerReviews] = await Promise.all([
  readFile(new URL('app/api/bookings/[bookingId]/attendance/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/bookings/[bookingId]/attendance/route.ts', root), 'utf8'),
  readFile(new URL('app/api/bookings/[bookingId]/closeout/route.ts', root), 'utf8'),
  readFile(new URL('server/bookings/closeout.ts', root), 'utf8'),
  readFile(new URL('app/api/reviews/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/reviews/route.ts', root), 'utf8'),
]);

test('customer and provider attendance keep their existing actions on bearer-aware RLS clients', () => {
  assert.ok(customerAttendance.includes('productionAuthProvider.requireCustomer(request)'));
  assert.ok(customerAttendance.includes('createSupabaseServerClient(request)'));
  assert.ok(customerAttendance.includes("action?: 'confirm_completion' | 'report_provider_no_show'"));
  assert.ok(customerAttendance.includes("supabase.rpc('customer_confirm_service_completion', { target_booking_id: bookingId })"));
  assert.ok(customerAttendance.includes("supabase.rpc('customer_report_provider_no_show', { target_booking_id: bookingId, report_note: note })"));
  assert.ok(customerAttendance.includes('note.length > 1000'));
  assert.ok(customerAttendance.includes('getBookingCloseoutReadModel(bookingId, session.user_id, request)'));

  assert.ok(providerAttendance.includes('productionAuthProvider.requireProvider(request)'));
  assert.ok(providerAttendance.includes('createSupabaseServerClient(request)'));
  assert.ok(providerAttendance.includes("action?: 'report_customer_no_show'"));
  assert.ok(providerAttendance.includes("supabase.rpc('provider_report_customer_no_show', { target_booking_id: bookingId, report_note: note })"));
  assert.ok(providerAttendance.includes('note.length > 1000'));
  assert.ok(providerAttendance.includes('getBookingCloseoutReadModel(bookingId, session.user_id, request)'));
});

test('closeout read model propagates Request without changing SLA or payment-status blockers', () => {
  assert.ok(closeoutRoute.includes('productionAuthProvider.getSession(request)'));
  assert.ok(closeoutRoute.includes('getBookingCloseoutReadModel(bookingId, session.user_id, request)'));
  assert.ok(closeoutSource.includes('getBookingCloseoutReadModel(bookingId: string, viewerUserId: string, request?: Request)'));
  assert.ok(closeoutSource.includes('createSupabaseServerClient(request)'));
  assert.ok(closeoutSource.includes("supabase.rpc('apply_booking_closeout_rules', { target_booking_id: bookingId })"));
  assert.ok(closeoutSource.includes("if (!['paid', 'refunded'].includes(String(booking.payment_status))) closeBlockers.push('payment_unsettled')"));
  assert.ok(closeoutSource.includes("closeBlockers.push('sla_window_open')"));
  assert.ok(closeoutSource.includes('review_window_open: reviewWindowOpen'));
  assert.ok(closeoutSource.includes('support_window_open: supportWindowOpen'));
});

test('customer reviews preserve eligibility and payload semantics on the bearer client', () => {
  assert.equal((customerReviews.match(/productionAuthProvider\.requireCustomer\(request\)/g) ?? []).length, 2);
  assert.equal((customerReviews.match(/createSupabaseServerClient\(request\)/g) ?? []).length, 2);
  assert.ok(customerReviews.includes('Number(input.rating) < 1 || Number(input.rating) > 5'));
  assert.ok(customerReviews.includes("booking.status !== 'completed'"));
  assert.ok(customerReviews.includes('getBookingCloseoutReadModel(String(booking.id), session.user_id, request)'));
  assert.ok(customerReviews.includes('closeout?.review_window_open'));
  assert.ok(customerReviews.includes("You have already reviewed this booking."));
  assert.ok(customerReviews.includes("input.comment?.trim().slice(0, 1000) || null"));
  assert.ok(customerReviews.includes("status: 'published'"));
  assert.ok(customerReviews.includes('{ status: 201 }'));
});

test('provider review list and response preserve ownership and response contracts on the bearer client', () => {
  assert.ok(providerReviews.includes('async function resolveProvider(request?: Request)'));
  assert.ok(providerReviews.includes('productionAuthProvider.requireProvider(request)'));
  assert.ok(providerReviews.includes('createSupabaseServerClient(request)'));
  assert.ok(providerReviews.includes('resolveProvider(request)'));
  assert.ok(providerReviews.includes("providerType === 'professional' ? query.eq('professional_id', providerId) : query.eq('business_id', providerId)"));
  assert.ok(providerReviews.includes('responseText.length < 3 || responseText.length > 1000'));
  assert.ok(providerReviews.includes("supabase.rpc('respond_to_owned_review', { target_review_id: reviewId, response_text: responseText })"));
});

test('completion and reviews bearer slice does not activate finance, cash collection or frozen recovery flows', () => {
  const combined = [customerAttendance, providerAttendance, closeoutRoute, customerReviews, providerReviews].join('\n').toLowerCase();
  for (const forbidden of ['cashfree', 'cash-collection', '/api/pay', 'payment-intent', 'payout', 'settlement', 'reconciliation', 'requirementoccurrencerecoverypanel']) {
    assert.ok(!combined.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
