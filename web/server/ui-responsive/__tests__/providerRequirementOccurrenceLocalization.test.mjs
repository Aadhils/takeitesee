import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderRequirementOccurrenceContext.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/RemainingWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider requirement occurrence context uses shared booking localization', () => {
  assert.ok(source.includes('useRemainingWorkspaceTranslations'));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes('tamil ?'));
  assert.ok(!source.includes('WEEKDAY_NAMES'));

  const keys = [...new Set([...source.matchAll(/t\('(providerBooking\.occurrence\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 18, 'expected requirement occurrence localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider requirement occurrence context preserves booking requirement API and refresh behavior', () => {
  assert.ok(source.includes('/api/provider/bookings/${encodeURIComponent(bookingId)}/requirement-context'));
  assert.ok(source.includes("cache: 'no-store'"));
  assert.ok(source.includes("window.addEventListener('booking:provider-list-refresh', refresh)"));
  assert.ok(source.includes("window.removeEventListener('booking:provider-list-refresh', refresh)"));
  assert.ok(source.includes('onResolved?.(Boolean(payload.context))'));
  assert.ok(source.includes('onResolved?.(false)'));
});

test('Provider requirement occurrence context preserves customer coordination, journey and recovery routing', () => {
  assert.ok(source.includes('/provider/messages?conversation='));
  assert.ok(source.includes('<SmartServiceJourneyGuide bookingId={bookingId} viewer="provider" chatHref={chatHref} />'));
  assert.ok(source.includes('/provider/bookings/${encodeURIComponent(context.recovery.prior_booking_id)}'));
  assert.ok(source.includes("context.requirement_status === 'fulfilled' && recurring"));
  assert.ok(source.includes('context.recovery.attempt_number'));
});
