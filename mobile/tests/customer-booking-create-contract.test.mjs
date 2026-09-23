import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mobileRoot = new URL('../', import.meta.url);
const repoRoot = new URL('../', mobileRoot);

const [
  bookingsClient,
  serviceDetail,
  bookingScreen,
  serviceAvailabilityRoute,
  bookingRoute,
  bookingRepository,
] = await Promise.all([
  readFile(new URL('lib/bookings.ts', mobileRoot), 'utf8'),
  readFile(new URL('app/service/[serviceId].tsx', mobileRoot), 'utf8'),
  readFile(new URL('app/book-service/[serviceId].tsx', mobileRoot), 'utf8'),
  readFile(new URL('web/app/api/services/[serviceId]/availability/route.ts', repoRoot), 'utf8'),
  readFile(new URL('web/app/api/bookings/route.ts', repoRoot), 'utf8'),
  readFile(new URL('web/server/bookings/repository.ts', repoRoot), 'utf8'),
]);

test('native direct booking uses existing public availability and authenticated booking routes', () => {
  assert.ok(bookingsClient.includes('fetchServiceBookingAvailability'));
  assert.ok(bookingsClient.includes('`/api/services/${encodeURIComponent(serviceId)}/availability`'));
  assert.ok(bookingsClient.includes("method: 'GET'"));
  assert.ok(bookingsClient.includes('createCustomerBooking'));
  assert.ok(bookingsClient.includes("apiFetch<{ booking: CustomerBooking }>('/api/bookings'"));
  assert.ok(bookingsClient.includes("method: 'POST'"));
  assert.ok(bookingsClient.includes('accessToken'));
  assert.ok(bookingsClient.includes('idempotency_key: input.idempotency_key'));
  assert.ok(bookingsClient.includes('start_time: bookingTimeTo24Hour(input.time_label)'));
});

test('Service detail exposes direct booking only for bookable public service metadata while retaining request flow', () => {
  assert.ok(serviceDetail.includes('directBookingReady'));
  assert.ok(serviceDetail.includes("['INR', 'USD'].includes(state.service.currency)"));
  assert.ok(serviceDetail.includes("pathname: '/book-service/[serviceId]'"));
  assert.ok(serviceDetail.includes('Book an available time'));
  assert.ok(serviceDetail.includes('Request this service'));
});

test('Customer direct booking UI selects only live server-generated dates and slots', () => {
  assert.ok(bookingScreen.includes("auth.status === 'signedOut'"));
  assert.ok(bookingScreen.includes('fetchPublicProvider(providerType, providerId)'));
  assert.ok(bookingScreen.includes('fetchServiceBookingAvailability(serviceId)'));
  assert.ok(bookingScreen.includes('findProviderService(provider, serviceId)'));
  assert.ok(bookingScreen.includes('day.slots.some((slot) => slot.available)'));
  assert.ok(bookingScreen.includes('day.slots.filter((slot) => slot.available)'));
  assert.ok(bookingScreen.includes('disabled={!slot.available}'));
  assert.ok(bookingScreen.includes('setSelectedTime(slot.time)'));
  assert.ok(!bookingScreen.includes('TextInput'));
  assert.ok(bookingScreen.includes('Only live server-generated availability can be selected.'));
});

test('existing server remains authoritative for availability, ownership, canonical service data and conflicts', () => {
  assert.ok(serviceAvailabilityRoute.includes('loadServiceSlotAvailability(serviceId)'));
  assert.ok(bookingRoute.includes('productionAuthProvider.requireCustomer(request)'));
  assert.ok(bookingRoute.includes('assertCustomerIsNotProviderOwner(session, input.provider_type, input.provider_id, request)'));
  assert.ok(bookingRoute.includes('productionBookingRepository.createBooking(session, input, request)'));

  assert.ok(bookingRepository.includes('validateCreateBookingInput(input)'));
  assert.ok(bookingRepository.includes(".eq('active', true)"));
  assert.ok(bookingRepository.includes(".eq('status', 'active')"));
  assert.ok(bookingRepository.includes('duration_minutes: durationMinutes'));
  assert.ok(bookingRepository.includes('quoted_price: quotedPrice'));
  assert.ok(bookingRepository.includes('location: String(service.location || input.location).trim()'));
  assert.ok(bookingRepository.includes('await assertBookingAvailability(canonicalInput, undefined, request)'));
  assert.ok(bookingRepository.includes("status: 'pending'"));
});

test('direct booking slice does not activate finance, support, completion, recovery or cash collection', () => {
  const slice = `${bookingsClient}\n${serviceDetail}\n${bookingScreen}`.toLowerCase();
  for (const forbidden of [
    '/checkout',
    '/api/payments',
    '/api/cashfree',
    '/refund',
    '/payout',
    '/settlement',
    '/reconciliation',
    '/recovery',
    '/support',
    'cash collection',
    'cash-collection',
    'requirementoccurrencerecoverypanel',
    "submitaction('complete')",
    "action: 'report_provider_no_show'",
  ]) {
    assert.ok(!slice.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
  assert.ok(bookingScreen.includes('No payment is collected here.'));
});
