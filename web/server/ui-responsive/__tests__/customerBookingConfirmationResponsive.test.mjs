import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [layoutSource, cssSource, confirmationSource, bookingConfirmationRoute, legacyConfirmationRoute] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('app/customer-booking-confirmation-responsive.css', root), 'utf8'),
  readFile(new URL('components/booking/CustomerBookingConfirmation.tsx', root), 'utf8'),
  readFile(new URL('app/bookings/[bookingId]/confirmation/page.tsx', root), 'utf8'),
  readFile(new URL('app/confirmation/[bookingId]/page.tsx', root), 'utf8'),
]);

test('Customer Booking Confirmation loads the dedicated responsive layer', () => {
  assert.match(layoutSource, /customer-booking-confirmation-responsive\.css/);
  assert.match(cssSource, /\.confirmation-page/);
  assert.match(cssSource, /overflow-x:\s*clip/);
  assert.match(cssSource, /overflow-wrap:\s*anywhere/);
  assert.match(cssSource, /min-height:\s*44px/);
  assert.match(cssSource, /@media \(max-width:\s*760px\)/);
  assert.match(cssSource, /@media \(max-width:\s*560px\)/);
  assert.match(cssSource, /@media \(max-width:\s*420px\)/);
  assert.match(cssSource, /safe-area-inset-bottom/);
});

test('confirmation facts and actions become phone-safe without hiding content', () => {
  assert.match(cssSource, /\.confirmation-page \.review-details div[\s\S]*flex-direction:\s*column/);
  assert.match(cssSource, /\.confirmation-page \.review-details dd[\s\S]*max-width:\s*100%[\s\S]*text-align:\s*left/);
  assert.match(cssSource, /\.confirmation-page \.payment-line[\s\S]*flex-direction:\s*column/);
  assert.match(cssSource, /\.confirmation-page \.confirmation-actions \.button[\s\S]*width:\s*100%/);
  assert.match(cssSource, /\.confirmation-page \.confirmation-reference strong[\s\S]*letter-spacing:\s*\.04em/);
});

test('live confirmation behavior and destinations stay unchanged', () => {
  assert.match(confirmationSource, /getBookingThroughConfiguredRepository\(bookingId/);
  assert.match(confirmationSource, /booking\.status === 'pending'/);
  assert.match(confirmationSource, /booking\.paymentStatus === 'paid'/);
  assert.match(confirmationSource, /No successful payment is recorded for this booking yet\./);
  assert.match(confirmationSource, /href=\{`\/bookings\/\$\{booking\.bookingId\}`\}/);
  assert.match(confirmationSource, /href="\/bookings"/);
  assert.match(confirmationSource, /href="\/explore"/);
  assert.match(bookingConfirmationRoute, /CustomerBookingConfirmation/);
  assert.match(legacyConfirmationRoute, /CustomerBookingConfirmation/);
});
