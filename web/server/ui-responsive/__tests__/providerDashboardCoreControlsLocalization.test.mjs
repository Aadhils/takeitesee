import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const paths = [
  'components/provider/ProviderDashboardHandleCenter.tsx',
  'components/provider/ProviderDashboardLaunchCenter.tsx',
  'components/provider/ProviderLiveAvailabilityControl.tsx',
  'components/provider/ProviderLiveLocationControl.tsx',
];
const [catalogSource, ...sources] = await Promise.all([
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
  ...paths.map((path) => readFile(new URL(path, root), 'utf8')),
]);

const combined = sources.join('\n');
const keys = [...new Set(
  [...combined.matchAll(/t\('(provider\.(?:handle|launch|live|liveLocation)\.[^']+)'\)/g)].map((match) => match[1]),
)];

test('Provider core dashboard controls use the shared translation catalog', () => {
  assert.ok(keys.length >= 80);
  assert.ok(!sources[0].includes('const tamil'));
  assert.ok(!sources[0].includes('const copy ='));
  assert.ok(!sources[1].includes('const tamil'));
  assert.ok(!sources[1].includes('const copy ='));
});

test('Every migrated Provider core-control key exists in both English and Tamil catalogs', () => {
  for (const key of keys) {
    const occurrences = catalogSource.split(`'${key}'`).length - 1;
    assert.equal(occurrences, 2, `${key} should exist once in English and once in Tamil`);
  }
});

test('Provider handle API contract remains unchanged', () => {
  const source = sources[0];
  assert.ok(source.includes("fetch('/api/identity-handle?context=provider'"));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes('public_profile_ready'));
  assert.ok(source.includes('readiness_href'));
  assert.ok(source.includes('navigator.clipboard.writeText(publicUrl)'));
});

test('Marketplace launch workflow contracts remain unchanged', () => {
  const source = sources[1];
  assert.ok(source.includes("fetch('/api/provider/services'"));
  assert.ok(source.includes("fetch('/api/provider/setup'"));
  assert.ok(source.includes("method: 'POST'"));
  assert.ok(source.includes("method: 'DELETE'"));
  assert.ok(source.includes("body: JSON.stringify({ status: 'active' })"));
  assert.ok(source.includes('application_id: category.application_id'));
  assert.ok(source.includes('category_id: category.id'));
  assert.ok(source.includes('location_id: locationId'));
});

test('Live availability and live location behavior contracts remain unchanged', () => {
  const availability = sources[2];
  const location = sources[3];
  assert.ok(availability.includes("fetch('/api/provider/live-availability'"));
  assert.ok(availability.includes("method: 'PUT'"));
  assert.ok(availability.includes('work_mode: nextMode'));
  assert.ok(availability.includes('mode_expires_at: modeExpiresAt'));
  assert.ok(location.includes("fetch('/api/provider/live-location'"));
  assert.ok(location.includes("action: 'share'"));
  assert.ok(location.includes("action: 'stop'"));
  assert.ok(location.includes('navigator.geolocation.getCurrentPosition'));
});

test('Migrated Provider core controls no longer hardcode primary visible English copy', () => {
  const forbidden = [
    'Launch a service from this Dashboard',
    'Can you help customers now?',
    'Available and Busy automatically expire to Offline.',
    'One-time browser capture only. TakeItEsee does not start continuous background tracking',
    'No handle set yet',
  ];
  for (const phrase of forbidden) {
    assert.ok(!combined.includes(phrase), `localized core-control copy should not remain hardcoded: ${phrase}`);
  }
});
