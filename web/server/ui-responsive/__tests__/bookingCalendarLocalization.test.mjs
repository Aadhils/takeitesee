import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, route] = await Promise.all([
  readFile(new URL('components/booking/BookingCalendarAction.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/BookingCalendarTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/bookings/[bookingId]/calendar/route.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<BookingCalendarKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Booking Calendar uses shared EN/TA localization with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.deepEqual(tamilKeys, englishKeys);
  assert.deepEqual(englishKeys, ['bookingCalendar.add', 'bookingCalendar.help']);
  assert.ok(source.includes('useBookingCalendarTranslations'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Booking Calendar preserves the exact ICS download endpoint and browser download behavior', () => {
  assert.ok(source.includes('href={`/api/bookings/${encodeURIComponent(bookingId)}/calendar`}'));
  assert.ok(source.includes('download'));
  assert.ok(route.includes('export async function GET'));
  assert.ok(route.includes('productionAuthProvider.requireCustomer(request)'));
  assert.ok(route.includes('productionBookingRepository.getBookingById'));
  assert.ok(route.includes("'content-type': 'text/calendar; charset=utf-8'"));
  assert.ok(route.includes("'cache-control': 'private, no-store, max-age=0'"));
});

test('Booking Calendar localization remains read-only and outside finance/recurrence surfaces', () => {
  for (const term of ["method: 'POST'", "method: 'PATCH'", "method: 'DELETE'", '/api/pay', 'CashfreeClient', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
});
