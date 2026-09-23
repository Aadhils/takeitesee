import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [providers, requirements, explore, serviceDetail, providerProfile, requestService] = await Promise.all([
  readFile(new URL('lib/providers.ts', root), 'utf8'),
  readFile(new URL('lib/requirements.ts', root), 'utf8'),
  readFile(new URL('app/explore.tsx', root), 'utf8'),
  readFile(new URL('app/service/[serviceId].tsx', root), 'utf8'),
  readFile(new URL('app/providers/[providerType]/[providerId].tsx', root), 'utf8'),
  readFile(new URL('app/request-service.tsx', root), 'utf8'),
]);

test('service detail composes the frozen public provider detail contract instead of adding a backend route', () => {
  assert.ok(providers.includes('/api/marketplace/providers/${providerType}/${encodeURIComponent(providerId)}'));
  assert.ok(providers.includes('findProviderService'));
  assert.ok(serviceDetail.includes('fetchPublicProvider(providerType, providerId)'));
  assert.ok(serviceDetail.includes('findProviderService(provider, serviceId)'));
  assert.ok(!providers.includes('/api/mobile/service'));
  assert.ok(!serviceDetail.includes('/api/mobile/service'));
});

test('Explore passes opaque service and provider ids into the native detail route', () => {
  assert.ok(explore.includes("pathname: '/service/[serviceId]'"));
  assert.ok(explore.includes('serviceId: service.id'));
  assert.ok(explore.includes('providerType: service.provider_type'));
  assert.ok(explore.includes('providerId: service.provider_id'));
});

test('public provider profile stays on the frozen public provider JSON contract', () => {
  assert.ok(providerProfile.includes('fetchPublicProvider(providerType, providerId)'));
  assert.ok(providerProfile.includes("pathname: '/service/[serviceId]'"));
  assert.ok(providerProfile.includes('state.provider.marketplace_disclosure'));
  assert.ok(providerProfile.includes('state.provider.public_contact'));
});

test('customer action posts only an explicit one-time requirement and keeps recurrence frozen', () => {
  assert.ok(requirements.includes("'/api/requirements/catalog'"));
  assert.ok(requirements.includes("'/api/requirements'"));
  assert.ok(requirements.includes("schedule_pattern: 'one_time'"));
  assert.ok(requirements.includes('recurrence_frequency: null'));
  assert.ok(requirements.includes('recurrence_interval: null'));
  assert.ok(requirements.includes('recurrence_count: null'));
  assert.ok(requirements.includes('recurrence_weekdays: null'));
  assert.ok(requestService.includes('createOneTimeRequirement'));
  assert.ok(requestService.includes('Recurrence stays outside the native v1 flow.'));
});

test('requirement posting remains authenticated while Explore and provider detail stay public', () => {
  assert.ok(requirements.includes('supabase.auth.getSession()'));
  assert.ok(requirements.includes('accessToken'));
  assert.ok(requestService.includes("auth.status === 'signedOut'"));
  assert.ok(providers.includes("{ method: 'GET' }"));
});
