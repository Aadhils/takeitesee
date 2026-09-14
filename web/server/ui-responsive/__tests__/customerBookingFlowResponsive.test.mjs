import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [layoutSource, cssSource, selectionSource, reviewSource] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('app/customer-booking-flow-responsive.css', root), 'utf8'),
  readFile(new URL('components/detail/LiveBookingSelection.tsx', root), 'utf8'),
  readFile(new URL('components/booking/RealBookingReview.tsx', root), 'utf8'),
]);

test('Customer Booking Flow responsive layer loads after the shared foundation', () => {
  const foundationIndex = layoutSource.indexOf("import './responsive-foundation.css';");
  const bookingIndex = layoutSource.indexOf("import './customer-booking-flow-responsive.css';");
  assert.ok(foundationIndex >= 0, 'responsive foundation import missing');
  assert.ok(bookingIndex > foundationIndex, 'booking-flow responsive polish must load after the shared foundation');
});

test('booking selection remains width-safe and adapts date/time choices for phones', () => {
  assert.ok(cssSource.includes('.booking-flow,'));
  assert.ok(cssSource.includes('overflow-x: clip;'));
  assert.ok(cssSource.includes('.booking-flow .date-options {'));
  assert.ok(cssSource.includes('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'));
  assert.ok(cssSource.includes('@media (max-width: 480px)'));
  assert.ok(cssSource.includes('.booking-flow .time-options {'));
  assert.ok(cssSource.includes('@media (max-width: 390px)'));
  assert.ok(cssSource.includes('grid-template-columns: minmax(0, 1fr) !important;'));
  assert.ok(cssSource.includes('min-height: 44px;'));
});

test('booking review stacks long facts and keeps confirmation controls touch-friendly', () => {
  assert.ok(cssSource.includes('.booking-review-page .review-details div'));
  assert.ok(cssSource.includes('flex-direction: column;'));
  assert.ok(cssSource.includes('.booking-review-page .review-details dd'));
  assert.ok(cssSource.includes('text-align: left;'));
  assert.ok(cssSource.includes('.booking-review-page .terms-row input'));
  assert.ok(cssSource.includes('width: 22px;'));
  assert.ok(cssSource.includes('.booking-review-page .review-aside > .button'));
  assert.ok(cssSource.includes('font-size: 16px;'));
  assert.ok(cssSource.includes('env(safe-area-inset-bottom, 0px)'));
});

test('live availability and selection semantics remain unchanged', () => {
  assert.ok(selectionSource.includes("fetch(`/api/services/${service.id}/availability`"));
  assert.ok(selectionSource.includes("day.slots.filter((slot) => slot.available)"));
  assert.ok(selectionSource.includes('setSelectedTime(\'\')'));
  assert.ok(selectionSource.includes('/review?date='));
  assert.ok(selectionSource.includes('Availability is revalidated when the booking is confirmed'));
});

test('booking creation, auth return, idempotency and no-payment semantics remain unchanged', () => {
  assert.ok(reviewSource.includes('getCurrentCustomerAsync'));
  assert.ok(reviewSource.includes('saveBookingDraft(draft)'));
  assert.ok(reviewSource.includes('presentationAuthAdapter.getLoginPath(reviewPath)'));
  assert.ok(reviewSource.includes('createBookingThroughConfiguredRepository'));
  assert.ok(reviewSource.includes('idempotencyKey: `booking-${service.id}-${date}-${time}-${attemptId.current}`'));
  assert.ok(reviewSource.includes('window.location.assign(`/bookings/${booking.bookingId}/confirmation`)'));
  assert.ok(reviewSource.includes('payment is not collected here'));
});
