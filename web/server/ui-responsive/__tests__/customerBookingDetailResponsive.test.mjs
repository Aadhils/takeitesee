import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [componentSource, cssSource, calendarSource, calendarCssSource] = await Promise.all([
  readFile(new URL('components/booking/CustomerBookingDetail.tsx', root), 'utf8'),
  readFile(new URL('components/booking/CustomerBookingDetail.module.css', root), 'utf8'),
  readFile(new URL('components/booking/BookingCalendarAction.tsx', root), 'utf8'),
  readFile(new URL('components/booking/BookingCalendarAction.module.css', root), 'utf8'),
]);

test('Customer Booking Detail keeps the existing booking actions and lifecycle panels', () => {
  assert.ok(componentSource.includes('CustomerPaymentPanel'));
  assert.ok(componentSource.includes('BookingCloseoutPanel'));
  assert.ok(componentSource.includes('BookingAuditTimeline'));
  assert.ok(componentSource.includes('BookingReasonDialog'));
  assert.ok(componentSource.includes('/reschedule'));
  assert.ok(componentSource.includes("href=\"/explore\""));
});

test('Customer Booking Detail adds scoped responsive layout hooks', () => {
  assert.ok(componentSource.includes("import styles from './CustomerBookingDetail.module.css'"));
  assert.ok(componentSource.includes('styles.page'));
  assert.ok(componentSource.includes('styles.heading'));
  assert.ok(componentSource.includes('styles.layout'));
  assert.ok(componentSource.includes('styles.informationCard'));
  assert.ok(componentSource.includes('styles.aside'));
});

test('Customer Booking Detail mobile presentation prioritizes actions and wrap-safe facts', () => {
  assert.ok(cssSource.includes('@media (max-width: 760px)'));
  assert.ok(cssSource.includes('.layout > .aside'));
  assert.ok(cssSource.includes('order: -1 !important'));
  assert.ok(cssSource.includes('width: 100%'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('grid-template-columns: minmax(92px, .8fr) minmax(0, 1.2fr)'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('overflow-x: clip'));
});

test('Customer Booking Detail narrow phones stack information values safely', () => {
  assert.ok(cssSource.includes('@media (max-width: 480px)'));
  assert.ok(cssSource.includes('grid-template-columns: 1fr'));
  assert.ok(cssSource.includes('text-align: left'));
});

test('Booking calendar action is compact and responsive on real-device widths', () => {
  assert.ok(calendarSource.includes("import styles from './BookingCalendarAction.module.css'"));
  assert.ok(calendarSource.includes('className={styles.calendarAction}'));
  assert.ok(calendarCssSource.includes('@media (max-width: 760px)'));
  assert.ok(calendarCssSource.includes('grid-template-columns: minmax(0, 1fr) auto'));
  assert.ok(calendarCssSource.includes('@media (max-width: 560px)'));
  assert.ok(calendarCssSource.includes('width: 100%'));
});
