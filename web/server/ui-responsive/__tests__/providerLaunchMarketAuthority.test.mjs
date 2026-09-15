import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const migrationSource = await readFile(
  new URL('database/migrations/20260915174500_provider_launch_market_authority.sql', root),
  'utf8',
);

test('Provider launch options expose only enabled application markets', () => {
  assert.ok(migrationSource.includes("'application_locations'"));
  assert.ok(migrationSource.includes('from public.application_locations al'));
  assert.ok(migrationSource.includes("where al.enabled=true"));
  assert.ok(migrationSource.includes("pa.status='active'"));
  assert.ok(migrationSource.includes("pl.active=true"));
});

test('Both Provider launch submission entry points reject disabled markets', () => {
  const rejectionCount = (migrationSource.match(/Selected location is not enabled for this application\./g) ?? []).length;
  assert.equal(rejectionCount, 2);
  assert.ok(migrationSource.includes('create or replace function public.submit_service_launch_request('));
  assert.ok(migrationSource.includes('create or replace function public.submit_service_launch_request_for_type('));
});

test('Admin approval rechecks market availability before granting service scope', () => {
  assert.ok(migrationSource.includes('create or replace function public.review_service_launch_request('));
  assert.ok(migrationSource.includes('Requested location is no longer enabled for this application.'));
  const marketCheck = 'application_id=req.requested_application_id and location_id=req.requested_location_id and enabled=true';
  assert.ok(migrationSource.includes(marketCheck));
});

test('Public launchability follows the same application market authority', () => {
  assert.ok(migrationSource.includes('create or replace function private.service_scope_is_launchable'));
  assert.match(
    migrationSource,
    /join public\.application_locations al\s+on al\.application_id=ses\.application_id\s+and al\.location_id=ses\.location_id\s+and al\.enabled=true/,
  );
});
