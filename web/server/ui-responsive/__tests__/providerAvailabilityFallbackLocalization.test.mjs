import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderAvailabilityManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/RemainingWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider availability fallbacks use shared workspace localization', () => {
  const keys = [
    'availability.loadServicesFallback',
    'availability.loadFallback',
    'availability.saveFallback',
  ];
  for (const key of keys) {
    assert.ok(source.includes(`t('${key}')`), `${key} should be used by ProviderAvailabilityManager`);
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
  assert.ok(!source.includes('Unable to load provider services.'));
  assert.ok(!source.includes('Unable to load availability.'));
  assert.ok(!source.includes('Unable to save availability.'));
});

test('Provider availability preserves service and availability API contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/services', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch(`/api/provider/services/${selectedServiceId}/availability`, { cache: 'no-store' })"));
  assert.ok(source.includes("fetch(`/api/provider/services/${availability.service_id}/availability`, { method: 'PUT'"));
  assert.ok(source.includes("headers: { 'Content-Type': 'application/json' }"));
  assert.ok(source.includes('body: JSON.stringify(availability)'));
});

test('Provider availability preserves weekly-window and blackout safeguards', () => {
  assert.ok(source.includes('availability.weekly_windows'));
  assert.ok(source.includes('availability.blackout_periods'));
  assert.ok(source.includes("start_time: '09:00', end_time: '17:00'"));
  assert.ok(source.includes('new Date(blackoutDraft.ends_at) <= new Date(blackoutDraft.starts_at)'));
  assert.ok(source.includes("t('availability.chooseStartEnd')"));
  assert.ok(source.includes("t('availability.endAfterStart')"));
});
