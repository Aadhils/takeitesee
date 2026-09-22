import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [guide, translations] = await Promise.all([
  readFile(new URL('components/booking/BookingServiceExecutionGuide.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/BookingServiceExecutionTranslations.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<BookingServiceExecutionKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Booking Service Execution uses shared EN/TA localization with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.ok(englishKeys.length >= 20);
  assert.deepEqual(tamilKeys, englishKeys);
  assert.ok(guide.includes('useBookingServiceExecutionTranslations'));
  assert.ok(!guide.includes("startsWith('ta')"));
  assert.ok(!guide.includes('const tamil'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(guide));
});

test('Booking Service Execution preserves customer/provider read paths and fail-safe loading', () => {
  assert.ok(guide.includes("`/api/provider/bookings/${encodeURIComponent(bookingId)}`"));
  assert.ok(guide.includes("`/api/bookings/${encodeURIComponent(bookingId)}`"));
  assert.ok(guide.includes("fetch(path, { cache: 'no-store' })"));
  assert.ok(guide.includes('if (!response.ok) return;'));
  assert.ok(guide.includes('Optional guidance must never block the booking or requirement context.'));
});

test('Booking Service Execution preserves timing and phase semantics', () => {
  assert.ok(guide.includes("const zone = booking.timezone || 'Asia/Kolkata';"));
  assert.ok(guide.includes('const endAt = startAt + Math.max(Number(booking.duration_minutes) || 0, 0) * 60_000;'));
  assert.ok(guide.includes('window.setInterval(() => setNow(Date.now()), 30_000)'));
  assert.ok(guide.includes("booking.status !== 'confirmed'"));
  assert.ok(guide.includes("booking.attendance_outcome !== 'pending'"));
  assert.ok(guide.includes("const phase = beforeStart ? 'prepare' : inService ? 'service' : 'completion';"));
});

test('Booking Service Execution remains read-only', () => {
  assert.ok(!guide.includes("method: 'POST'"));
  assert.ok(!guide.includes("method: 'PATCH'"));
  assert.ok(!guide.includes("method: 'DELETE'"));
  assert.ok(!guide.includes('JSON.stringify('));
});

test('Booking Service Execution keeps locale-aware moment formatting and localized phase badges', () => {
  assert.ok(guide.includes("new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone })"));
  assert.ok(guide.includes("t('execution.badge.prepare')"));
  assert.ok(guide.includes("t('execution.badge.inService')"));
  assert.ok(guide.includes("t('execution.badge.completionDue')"));
  assert.ok(guide.includes("t('execution.eyebrow')"));
});

test('Booking Service Execution localization does not activate finance or recurrence surfaces', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!guide.includes(term));
  }
});
