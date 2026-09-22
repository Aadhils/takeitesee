import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, providerRoute, attendanceRoute, transition] = await Promise.all([
  readFile(new URL('components/booking/SmartServiceJourneyGuide.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/SmartServiceJourneyTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/bookings/[bookingId]/route.ts', root), 'utf8'),
  readFile(new URL('app/api/bookings/[bookingId]/attendance/route.ts', root), 'utf8'),
  readFile(new URL('server/provider-bookings/status-transition.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<SmartServiceJourneyKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Smart Service Journey uses focused EN/TA catalog with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.ok(englishKeys.length >= 50);
  assert.deepEqual(tamilKeys, englishKeys);
  assert.ok(source.includes('useSmartServiceJourneyTranslations'));
  assert.ok(source.includes('const { locale, t } = useSmartServiceJourneyTranslations()'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Smart Service Journey preserves booking reads, closeout refresh and 30-second clock', () => {
  assert.ok(source.includes("`/api/provider/bookings/${encodeURIComponent(bookingId)}`"));
  assert.ok(source.includes("`/api/bookings/${encodeURIComponent(bookingId)}`"));
  assert.ok(source.includes("`/api/bookings/${encodeURIComponent(bookingId)}/closeout`"));
  assert.ok(source.includes("window.setInterval(() => setNow(Date.now()), 30_000)"));
  assert.ok(source.includes("window.addEventListener('booking:closeout-refresh', refresh)"));
  assert.ok(source.includes("window.addEventListener('booking:provider-list-refresh', refresh)"));
});

test('Smart Service Journey preserves provider PATCH contract and server authorization', () => {
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes('body: JSON.stringify({ action, reason })'));
  assert.ok(source.includes("providerAction('accept')"));
  assert.ok(source.includes("providerAction('complete')"));
  assert.ok(source.includes("providerAction('decline', reason)"));
  assert.ok(providerRoute.includes('productionAuthProvider.requireProvider(request)'));
  assert.ok(providerRoute.includes("['accept', 'decline', 'complete'].includes(body.action)"));
  assert.ok(providerRoute.includes("if (body.action === 'decline')"));
  assert.ok(providerRoute.includes('reason.length < 3'));
  assert.ok(transition.includes("supabase.rpc('provider_update_booking_status'"));
});

test('Smart Service Journey preserves Customer completion POST contract and server authorization', () => {
  assert.ok(source.includes("viewer !== 'customer'"));
  assert.ok(source.includes('confirmedByCustomer'));
  assert.ok(source.includes('!closeout?.can_confirm_completion'));
  assert.ok(source.includes("method: 'POST'"));
  assert.ok(source.includes("body: JSON.stringify({ action: 'confirm_completion' })"));
  assert.ok(attendanceRoute.includes('productionAuthProvider.requireCustomer(request)'));
  assert.ok(attendanceRoute.includes("supabase.rpc('customer_confirm_service_completion'"));
});

test('Smart Service Journey preserves lifecycle ordering and action gates', () => {
  assert.ok(source.includes("booking.status === 'cancelled'"));
  assert.ok(source.includes('attendanceTerminal'));
  assert.ok(source.includes("viewer === 'provider' && booking.status === 'pending'"));
  assert.ok(source.includes("viewer === 'provider' && booking.status === 'rescheduled'"));
  assert.ok(source.includes("booking.status === 'confirmed' && beforeStart"));
  assert.ok(source.includes("booking.status === 'confirmed' && inService"));
  assert.ok(source.includes("booking.status === 'confirmed' && afterServiceWindow"));
  assert.ok(source.includes("booking.status === 'completed' && hasSupport"));
  assert.ok(source.includes("booking.status === 'completed' && viewer === 'customer' && !confirmedByCustomer && closeout?.can_confirm_completion"));
  assert.ok(source.includes("booking.status === 'completed' && viewer === 'customer' && confirmedByCustomer && !hasReview && closeout?.review_window_open !== false"));
});

test('Smart Service Journey preserves canonical decline reason payload values', () => {
  assert.ok(source.includes("const declineReasons = ['Schedule conflict', 'Service unavailable', 'Outside service area', 'Unable to fulfil request', 'Other']"));
  assert.ok(source.includes("const rescheduleDeclineReasons = ['New time unavailable', 'Schedule conflict', 'Unable to fulfil at requested time', 'Service unavailable', 'Other']"));
});

test('Smart Service Journey localization does not activate finance or recurrence surfaces', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
});
