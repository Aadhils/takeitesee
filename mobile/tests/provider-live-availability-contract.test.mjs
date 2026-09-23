import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mobileRoot = new URL('../', import.meta.url);
const repoRoot = new URL('../', mobileRoot);

const [client, screen, providerBookings, route, repository] = await Promise.all([
  readFile(new URL('lib/provider-live-availability.ts', mobileRoot), 'utf8'),
  readFile(new URL('app/provider-live-status.tsx', mobileRoot), 'utf8'),
  readFile(new URL('app/provider-bookings.tsx', mobileRoot), 'utf8'),
  readFile(new URL('web/app/api/provider/live-availability/route.ts', repoRoot), 'utf8'),
  readFile(new URL('web/server/provider-live-availability/repository.ts', repoRoot), 'utf8'),
]);

test('native Provider live availability uses the existing authenticated GET/PUT contract', () => {
  assert.ok(client.includes("'/api/provider/live-availability'"));
  assert.ok(client.includes("method: 'GET'"));
  assert.ok(client.includes("method: 'PUT'"));
  assert.ok(client.includes('accessToken'));
  assert.ok(client.includes('supabase.auth.getSession()'));
  assert.ok(client.includes('durationMinutes * 60 * 1000'));
  assert.ok(client.includes("workMode === 'available' || workMode === 'busy'"));
  assert.ok(client.includes('mode_expires_at: modeExpiresAt'));
});

test('native Provider live status is role-gated and keeps the established short expiry choices', () => {
  assert.ok(screen.includes("roles.includes('professional')"));
  assert.ok(screen.includes("roles.includes('business_owner')"));
  assert.ok(screen.includes('const durations: ProviderLiveDurationMinutes[] = [15, 30, 60]'));
  assert.ok(screen.includes('fetchProviderLiveAvailability'));
  assert.ok(screen.includes('updateProviderLiveAvailability'));
  assert.ok(screen.includes('effectiveProviderWorkMode'));
  assert.ok(screen.includes('does not change per-service booking schedules, booking states, or shop hours'));
  assert.ok(providerBookings.includes('href="/provider-live-status"'));
  assert.ok(providerBookings.includes('Live work status'));
});

test('Bearer request context is threaded from Provider route into all live-status Supabase calls', () => {
  assert.ok(route.includes('productionAuthProvider.requireProvider(request)'));
  assert.ok(route.includes('productionProviderLiveAvailabilityRepository.get(session, request)'));
  assert.ok(route.includes('productionProviderLiveAvailabilityRepository.save(session, input, request)'));
  assert.ok(repository.includes('resolveProviderIdentity(session: ServerCustomerSession, request?: Request)'));
  assert.ok(repository.includes('createSupabaseServerClient(request)'));
  assert.ok(repository.includes('async get(session: ServerCustomerSession, request?: Request)'));
  assert.ok(repository.includes('async save(session: ServerCustomerSession, input: ProviderLiveAvailabilityInput, request?: Request)'));
  assert.ok(repository.includes('return this.get(session, request)'));
});

test('server remains authoritative for identity conflict and expiry safety', () => {
  assert.ok(repository.includes('Provider identity conflict detected. One account may own only one Provider identity.'));
  assert.ok(repository.includes('Available and Busy live work modes require an expiry.'));
  assert.ok(repository.includes('Live work-mode expiry must be in the future.'));
  assert.ok(repository.includes('Live work-mode expiry cannot be more than two hours in the future.'));
  assert.ok(repository.includes("if (input.work_mode === 'offline' || input.work_mode === 'paused')"));
  assert.ok(repository.includes("if (workMode === 'available' || workMode === 'busy')"));
});

test('Provider live-status slice stays outside finance, completion, closeout and frozen recovery domains', () => {
  const slice = `${client}\n${screen}\n${route}\n${repository}`.toLowerCase();
  for (const forbidden of [
    '/api/payments',
    '/api/cashfree',
    '/checkout',
    '/refund',
    '/payout',
    '/settlement',
    '/reconciliation',
    '/recovery',
    '/closeout',
    "action: 'complete'",
    'requirementoccurrencerecoverypanel',
    'cash collection',
    'cash-collection',
  ]) {
    assert.ok(!slice.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
