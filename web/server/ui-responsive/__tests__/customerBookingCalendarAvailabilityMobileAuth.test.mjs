import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [calendarRoute, availabilityRoute, slotAvailability] = await Promise.all([
  readFile(new URL('app/api/bookings/[bookingId]/calendar/route.ts', root), 'utf8'),
  readFile(new URL('app/api/bookings/[bookingId]/availability/route.ts', root), 'utf8'),
  readFile(new URL('server/bookings/slot-availability.ts', root), 'utf8'),
]);

test('booking calendar keeps Customer auth and forwards Request to the owned booking read', () => {
  assert.ok(calendarRoute.includes('productionAuthProvider.requireCustomer(request)'));
  assert.ok(calendarRoute.includes('productionBookingRepository.getBookingById(session, bookingId as EntityId, request)'));
  assert.ok(calendarRoute.includes("'content-type': 'text/calendar; charset=utf-8'"));
  assert.ok(calendarRoute.includes("'cache-control': 'private, no-store, max-age=0'"));
  assert.ok(calendarRoute.includes('bookingCalendarFilename(booking.booking_reference)'));
});

test('owned reschedule availability uses the same Request without changing status eligibility', () => {
  assert.ok(availabilityRoute.includes('productionAuthProvider.requireCustomer(request)'));
  assert.ok(availabilityRoute.includes('productionBookingRepository.getBookingById(session, bookingId as EntityId, request)'));
  assert.ok(availabilityRoute.includes("['pending', 'confirmed', 'rescheduled'].includes(booking.status)"));
  assert.ok(availabilityRoute.includes('loadServiceSlotAvailability(booking.service_id, { excludeOwnedBookingId: bookingId }, request)'));
});

test('slot availability keeps public and owned conflict semantics while accepting an optional Request', () => {
  assert.ok(slotAvailability.includes('options: AvailabilityOptions = {}, request?: Request'));
  assert.ok(slotAvailability.includes('createSupabaseServerClient(request)'));
  assert.ok(slotAvailability.includes("supabase.rpc('get_reschedule_booking_conflicts'"));
  assert.ok(slotAvailability.includes('target_booking_id: options.excludeOwnedBookingId'));
  assert.ok(slotAvailability.includes("supabase.rpc('get_public_booking_conflicts'"));
  assert.ok(slotAvailability.includes(".from('service_availability_windows')"));
  assert.ok(slotAvailability.includes(".from('service_availability_blackouts')"));
  assert.ok(slotAvailability.includes("reason: blackout ? 'Provider blackout' : conflict ? 'Already booked' : undefined"));
});

test('calendar and reschedule-availability mobile auth stays outside finance and recovery domains', () => {
  const combined = [calendarRoute, availabilityRoute, slotAvailability].join('\n').toLowerCase();
  for (const forbidden of ['cashfree', 'refund', 'payout', 'settlement', 'reconciliation', 'payment-intent', 'payment-method', '/checkout', 'requirementoccurrencerecoverypanel']) {
    assert.ok(!combined.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
