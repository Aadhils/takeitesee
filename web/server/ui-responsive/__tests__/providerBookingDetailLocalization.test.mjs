import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderBookingDetail.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/RemainingWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider Booking Detail uses shared localization without local Tamil branching', () => {
  assert.ok(source.includes('useRemainingWorkspaceTranslations'));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(providerBooking\.[^']+|reason\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 45, 'expected broad Provider Booking Detail localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider Booking Detail preserves booking lifecycle API and refresh contracts', () => {
  assert.ok(source.includes("fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, { cache: 'no-store' })"));
  assert.ok(source.includes("fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, { method: 'PATCH'"));
  assert.ok(source.includes("booking:provider-list-refresh"));
  assert.ok(source.includes("booking:audit-refresh"));
  assert.ok(source.includes("booking:closeout-refresh"));
});

test('Provider Booking Detail preserves linked lifecycle panels', () => {
  assert.ok(source.includes('ProviderRequirementOccurrenceContext'));
  assert.ok(source.includes('ProviderCashCollectionPanel'));
  assert.ok(source.includes('BookingCloseoutPanel'));
  assert.ok(source.includes('BookingAuditTimeline'));
  assert.ok(source.includes("act('accept')"));
  assert.ok(source.includes("act('complete')"));
  assert.ok(source.includes("act('decline', reason)"));
});
