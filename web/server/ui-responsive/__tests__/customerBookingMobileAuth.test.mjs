import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [route, detailRoute, repository, ownership, availability] = await Promise.all([
  readFile(new URL('app/api/bookings/route.ts', root), 'utf8'),
  readFile(new URL('app/api/bookings/[bookingId]/route.ts', root), 'utf8'),
  readFile(new URL('server/bookings/repository.ts', root), 'utf8'),
  readFile(new URL('server/bookings/ownership.ts', root), 'utf8'),
  readFile(new URL('server/bookings/availability.ts', root), 'utf8'),
]);

test('customer booking list and create forward the bearer-bearing Request through RLS clients', () => {
  assert.equal((route.match(/productionAuthProvider\.requireCustomer\(request\)/g) ?? []).length, 2);
  assert.ok(route.includes('productionBookingRepository.getCustomerBookings(session, request)'));
  assert.ok(route.includes('const supabase = await createSupabaseServerClient(request)'));
  assert.ok(route.includes('assertCustomerIsNotProviderOwner(session, input.provider_type, input.provider_id, request)'));
  assert.ok(route.includes('productionBookingRepository.createBooking(session, input, request)'));
  assert.ok(repository.includes('createBooking(session: ServerCustomerSession, input: CreateBookingInput, request?: Request)'));
  assert.ok(repository.includes('getCustomerBookings(session: ServerCustomerSession, request?: Request)'));
  assert.ok(repository.includes('async createBooking(session, input, request)'));
  assert.ok(repository.includes('async getCustomerBookings(session, request)'));
});

test('customer booking detail, cancel and reschedule keep the bearer-bearing Request on RLS clients', () => {
  assert.equal((detailRoute.match(/productionAuthProvider\.requireCustomer\(request\)/g) ?? []).length, 2);
  assert.ok(detailRoute.includes('productionBookingRepository.getBookingById(session, bookingId as EntityId, request)'));
  assert.ok(detailRoute.includes('productionBookingRepository.updateBookingStatus(session, bookingId as EntityId, body.status, reason, request)'));
  assert.ok(detailRoute.includes('productionBookingRepository.rescheduleBooking(session, bookingId as EntityId, { booking_date: body.booking_date, start_time: body.start_time, reason }, request)'));
  assert.ok(repository.includes('getBookingById(session: ServerCustomerSession, bookingId: EntityId, request?: Request)'));
  assert.ok(repository.includes('updateBookingStatus(session: ServerCustomerSession, bookingId: EntityId, status: ProductionBookingStatus, reason?: string, request?: Request)'));
  assert.ok(repository.includes('rescheduleBooking(session: ServerCustomerSession, bookingId: EntityId, input: RescheduleBookingInput, request?: Request)'));
  assert.ok(repository.includes("supabase.rpc('cancel_owned_booking'"));
  assert.ok(repository.includes("supabase.rpc('reschedule_owned_booking'"));
  assert.ok(repository.includes('assertBookingAvailability(availabilityInput, bookingId, request)'));
});

test('self-booking ownership guard keeps both Professional and Business ownership semantics', () => {
  assert.ok(ownership.includes('request?: Request'));
  assert.ok(ownership.includes('createSupabaseServerClient(request)'));
  assert.ok(ownership.includes(".from('businesses')"));
  assert.ok(ownership.includes(".select('owner_user_id')"));
  assert.ok(ownership.includes(".from('professional_profiles')"));
  assert.ok(ownership.includes(".select('user_id')"));
  assert.equal((ownership.match(/You cannot book your own service\./g) ?? []).length, 2);
});

test('booking creation keeps idempotency, canonical service values and insert semantics unchanged', () => {
  assert.ok(repository.includes(".eq('idempotency_key', input.idempotency_key)"));
  assert.ok(repository.includes(".eq('active', true)"));
  assert.ok(repository.includes(".eq('status', 'active')"));
  assert.ok(repository.includes('duration_minutes: durationMinutes'));
  assert.ok(repository.includes("timezone: String(availabilitySetting?.timezone ?? 'Asia/Kolkata')"));
  assert.ok(repository.includes('quoted_price: quotedPrice'));
  assert.ok(repository.includes('service_name: String(service.name)'));
  assert.ok(repository.includes('assertBookingAvailability(canonicalInput, undefined, request)'));
  assert.ok(repository.includes("status: 'pending'"));
  assert.ok(repository.includes("payment_status: 'unpaid'"));
  assert.ok(repository.includes('customer_id: session.user_id'));
});

test('booking availability uses the same Request without changing windows, blackouts or conflict RPCs', () => {
  assert.ok(availability.includes('excludeBookingId?: EntityId, request?: Request'));
  assert.ok(availability.includes('createSupabaseServerClient(request)'));
  assert.ok(availability.includes(".from('service_availability_windows')"));
  assert.ok(availability.includes(".from('service_availability_blackouts')"));
  assert.ok(availability.includes("supabase.rpc('get_reschedule_booking_conflicts'"));
  assert.ok(availability.includes("supabase.rpc('get_public_booking_conflicts'"));
  assert.ok(availability.includes('The provider already has a booking during the selected time.'));
});

test('customer booking mobile-auth slice does not touch finance or frozen recovery routes', () => {
  const combined = [route, detailRoute, repository, ownership, availability].join('\n').toLowerCase();
  for (const forbidden of ['cashfree', 'refund', 'payout', 'settlement', 'reconciliation', 'payment-intent', 'payment-method', '/checkout', 'requirementoccurrencerecoverypanel']) {
    assert.ok(!combined.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
