import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const client = readFileSync(new URL('../lib/provider-service-availability.ts', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../app/provider-service-availability.tsx', import.meta.url), 'utf8');
const hub = readFileSync(new URL('../app/provider-bookings.tsx', import.meta.url), 'utf8');
const route = readFileSync(new URL('../../web/app/api/mobile/provider/service-availability/route.ts', import.meta.url), 'utf8');

test('Provider service availability uses bearer-authenticated native API', () => {
  assert.match(client, /supabase\.auth\.getSession\(\)/);
  assert.match(client, /accessToken/);
  assert.match(client, /\/api\/mobile\/provider\/service-availability/);
  assert.match(route, /productionAuthProvider\.requireProvider\(request\)/);
  assert.match(route, /createSupabaseServerClient\(request\)/);
});

test('server verifies one Provider identity and owned service before mutation', () => {
  assert.match(route, /Provider identity conflict detected/);
  assert.match(route, /professional_profiles/);
  assert.match(route, /businesses/);
  assert.match(route, /Service was not found or is not owned by this Provider/);
  assert.match(route, /provider_type/);
});

test('quick mode update preserves detailed scheduling state', () => {
  assert.match(route, /service_availability/);
  assert.match(route, /weeklyWindowCount/);
  assert.match(route, /Scheduled availability requires existing weekly hours/);
  assert.doesNotMatch(route, /service_availability_windows'\)\.delete/);
  assert.doesNotMatch(route, /service_availability_blackouts'\)\.delete/);
  assert.match(screen, /Existing timezone, weekly hours and blackout periods are preserved/);
});

test('native UI exposes only bounded service booking modes', () => {
  assert.match(screen, /always_available/);
  assert.match(screen, /on_request/);
  assert.match(screen, /scheduled/);
  assert.match(screen, /weekly_window_count === 0/);
  assert.match(hub, /provider-service-availability/);
  assert.match(hub, /Service booking mode/);
});

test('frozen and finance domains stay outside this slice', () => {
  const combined = `${client}\n${screen}\n${route}`;
  for (const forbidden of ['Cashfree', 'refund', 'payout', 'settlement', 'reconciliation', 'RequirementOccurrenceRecoveryPanel', "action: 'complete'"]) {
    assert.ok(!combined.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
