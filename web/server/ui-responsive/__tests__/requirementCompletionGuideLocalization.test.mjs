import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, attendanceRoute, closeoutRoute] = await Promise.all([
  readFile(new URL('components/booking/RequirementCompletionGuide.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/RequirementCompletionTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/bookings/[bookingId]/attendance/route.ts', root), 'utf8'),
  readFile(new URL('app/api/bookings/[bookingId]/closeout/route.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<RequirementCompletionKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Requirement Completion Guide uses focused EN/TA localization with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.deepEqual(tamilKeys, englishKeys);
  assert.ok(englishKeys.length >= 25);
  assert.ok(source.includes('useRequirementCompletionTranslations'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Requirement Completion Guide preserves booking and closeout reads for both viewers', () => {
  assert.ok(source.includes("viewer === 'provider'"));
  assert.ok(source.includes('`/api/provider/bookings/${encodeURIComponent(bookingId)}`'));
  assert.ok(source.includes('`/api/bookings/${encodeURIComponent(bookingId)}`'));
  assert.ok(source.includes('fetch(`/api/bookings/${encodeURIComponent(bookingId)}/closeout`, { cache: \'no-store\' })'));
  assert.ok(source.includes("setCompleted(payload.booking?.status === 'completed')"));
  assert.ok(closeoutRoute.includes('productionAuthProvider.getSession(request)'));
  assert.ok(closeoutRoute.includes('getBookingCloseoutReadModel(bookingId, session.user_id)'));
});

test('Customer completion confirmation preserves exact POST endpoint, payload and guards', () => {
  assert.ok(source.includes("if (viewer !== 'customer' || busy || confirmed || !closeout.can_confirm_completion) return;"));
  assert.ok(source.includes('fetch(`/api/bookings/${encodeURIComponent(bookingId)}/attendance`, {'));
  assert.ok(source.includes("method: 'POST'"));
  assert.ok(source.includes("body: JSON.stringify({ action: 'confirm_completion' })"));
  assert.ok(attendanceRoute.includes('productionAuthProvider.requireCustomer(request)'));
  assert.ok(attendanceRoute.includes("body.action === 'confirm_completion'"));
  assert.ok(attendanceRoute.includes("supabase.rpc('customer_confirm_service_completion', { target_booking_id: bookingId })"));
});

test('Requirement Completion Guide preserves closeout refresh and audit events', () => {
  assert.ok(source.includes("window.addEventListener('booking:closeout-refresh', refresh)"));
  assert.ok(source.includes("window.addEventListener('booking:provider-list-refresh', refresh)"));
  assert.ok(source.includes("new CustomEvent('booking:closeout-refresh', { detail: { bookingId } })"));
  assert.ok(source.includes("new CustomEvent('booking:audit-refresh', { detail: { bookingId } })"));
});

test('Requirement Completion Guide preserves support, acknowledgement and review decision order', () => {
  assert.ok(source.includes("const hasSupport = Boolean(closeout.active_issue)"));
  assert.ok(source.includes("const confirmed = Boolean(closeout.customer_completion_confirmed_at)"));
  assert.ok(source.includes("const hasReview = Boolean(closeout.review)"));
  assert.ok(source.includes(": !confirmed && closeout.can_confirm_completion"));
  assert.ok(source.includes(": confirmed && !hasReview"));
});

test('Requirement Completion localization does not activate finance or recurrence surfaces', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
});
