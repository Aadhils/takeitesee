import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [layoutSource, fallbackSource] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('app/bookings-real-device-fix.css', root), 'utf8'),
]);

test('Customer Bookings real-device fallback loads after shared responsive layers', () => {
  const foundationIndex = layoutSource.indexOf("import './responsive-foundation.css';");
  const accountFallbackIndex = layoutSource.indexOf("import './account-real-device-fix.css';");
  const bookingsFallbackIndex = layoutSource.indexOf("import './bookings-real-device-fix.css';");

  assert.ok(foundationIndex >= 0, 'responsive foundation import missing');
  assert.ok(accountFallbackIndex > foundationIndex, 'account real-device fallback should remain after foundation');
  assert.ok(bookingsFallbackIndex > accountFallbackIndex, 'Bookings fallback must load after existing responsive fallbacks');
});

test('Customer Bookings phone lifecycle headings and empty states stay compact', () => {
  assert.ok(fallbackSource.includes('@media (max-width: 640px)'));
  assert.ok(fallbackSource.includes('.bookings-page .booking-group .section-heading'));
  assert.ok(fallbackSource.includes('flex-direction: row'));
  assert.ok(fallbackSource.includes('.bookings-page .booking-group .results-note'));
  assert.ok(fallbackSource.includes('width: auto'));
  assert.ok(fallbackSource.includes('border-radius: 999px'));
  assert.ok(fallbackSource.includes('.bookings-page .booking-group > .card > .state-panel'));
  assert.ok(fallbackSource.includes('padding: 16px 14px'));
  assert.ok(fallbackSource.includes('min-height: 0'));
});
