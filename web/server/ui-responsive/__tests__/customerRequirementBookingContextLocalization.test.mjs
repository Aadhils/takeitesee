import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, route] = await Promise.all([
  readFile(new URL('components/booking/CustomerRequirementBookingContext.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/RequirementBookingContextTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/bookings/[bookingId]/requirement-context/route.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<RequirementBookingContextKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Customer Requirement Booking Context uses focused EN/TA localization with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.deepEqual(tamilKeys, englishKeys);
  assert.equal(englishKeys.length, 5);
  assert.ok(source.includes('useRequirementBookingContextTranslations'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Customer Requirement Booking Context preserves read-only context loading', () => {
  assert.ok(source.includes('fetch(`/api/bookings/${encodeURIComponent(bookingId)}/requirement-context`, { cache: \'no-store\' })'));
  assert.ok(source.includes('if (!response.ok) return;'));
  assert.ok(source.includes('if (active) setContext(payload.context ?? null);'));
  assert.ok(source.includes('if (!context) return null;'));
  assert.ok(route.includes('export async function GET'));
  assert.ok(route.includes('productionAuthProvider.requireCustomer(request)'));
  assert.ok(route.includes(".from('marketplace_requirement_jobs')"));
  assert.ok(route.includes(".from('customer_requirements')"));
  assert.ok(route.includes(".from('marketplace_conversations')"));
});

test('Customer Requirement Booking Context preserves message and requirement destinations', () => {
  assert.ok(source.includes('`/messages?conversation=${encodeURIComponent(context.conversation_id)}`'));
  assert.ok(source.includes(": '/messages'"));
  assert.ok(source.includes('href={`/requirements/${encodeURIComponent(context.requirement_id)}`}'));
  assert.ok(source.includes('<SmartServiceJourneyGuide bookingId={bookingId} viewer="customer" chatHref={chatHref} />'));
});

test('Customer Requirement Booking Context localization remains mutation-free and outside finance/recurrence', () => {
  for (const term of ["method: 'POST'", "method: 'PATCH'", "method: 'DELETE'", '/api/pay', 'CashfreeClient', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
});
