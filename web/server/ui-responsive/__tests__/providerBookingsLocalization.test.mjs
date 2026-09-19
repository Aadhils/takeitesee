import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderBookingsManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/OperationalTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider Bookings list uses shared operational localization without local Tamil branching', () => {
  assert.ok(source.includes('useOperationalTranslations'));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(provider\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 45, 'expected broad Provider Bookings localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider Bookings preserves list, refresh and lifecycle action contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/bookings', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, { method: 'PATCH'"));
  assert.ok(source.includes("act(booking.id, 'accept')"));
  assert.ok(source.includes("act(booking.id, 'complete')"));
  assert.ok(source.includes("act(declineTarget.id, 'decline', reason)"));
  assert.ok(source.includes("booking:provider-list-refresh"));
});

test('Provider Bookings preserves queue and closeout semantics', () => {
  assert.ok(source.includes("booking.closeout_state === 'eligible_to_close'"));
  assert.ok(source.includes("booking.closeout_state === 'support_open'"));
  assert.ok(source.includes("booking.attendance_outcome === 'customer_no_show'"));
  assert.ok(source.includes("booking.attendance_outcome === 'provider_no_show'"));
  assert.ok(source.includes("booking.status === 'rescheduled'"));
  assert.ok(source.includes("booking.status === 'confirmed'"));
});
