import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderSetupManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/RemainingWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider Setup uses shared localization for the live launch-readiness journey', () => {
  assert.ok(source.includes('useRemainingWorkspaceTranslations'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(setup\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 55, 'expected broad Provider Setup localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider Setup preserves readiness and controlled-launch API contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/setup', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/provider/setup', { method: 'POST'"));
  assert.ok(source.includes("fetch('/api/provider/setup', { method: 'DELETE'"));
  assert.ok(source.includes('service_id: service.id'));
  assert.ok(source.includes('application_id: applicationId'));
  assert.ok(source.includes('category_id: categoryId'));
  assert.ok(source.includes('location_id: locationId'));
  assert.ok(source.includes('request_id: requestId'));
});

test('Provider Setup preserves canonical category, readiness and activation gates', () => {
  assert.ok(source.includes('normalizedCategory(category.name) === normalizedCategory(service.catalog_category)'));
  assert.ok(source.includes('marketplace_disclosure_complete'));
  assert.ok(source.includes("readiness.trust_status === 'normal'"));
  assert.ok(source.includes('readiness.first_service_scoped'));
  assert.ok(source.includes('service.scope_enabled'));
  assert.ok(source.includes('service.launch_ready'));
  assert.ok(source.includes('disabled={!readiness.profile_complete}'));
});
