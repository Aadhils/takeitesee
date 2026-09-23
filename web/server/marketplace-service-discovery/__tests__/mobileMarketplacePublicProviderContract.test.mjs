import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [searchRoute, nearbyRoute, responseMapping, providerRoute, directorySource] = await Promise.all([
  readFile(new URL('app/api/marketplace/services/search/route.ts', root), 'utf8'),
  readFile(new URL('app/api/marketplace/services/nearby/route.ts', root), 'utf8'),
  readFile(new URL('server/marketplace-service-discovery/responseMapping.ts', root), 'utf8'),
  readFile(new URL('app/api/marketplace/providers/route.ts', root), 'utf8'),
  readFile(new URL('server/marketplace/public-directory.ts', root), 'utf8'),
]);

test('normal and nearby discovery remain public JSON contracts for native clients', () => {
  assert.ok(searchRoute.includes('export async function GET(request: Request)'));
  assert.ok(searchRoute.includes("supabase.rpc('search_marketplace_service_discovery_candidates_v2'"));
  assert.ok(searchRoute.includes("'Cache-Control': 'no-store'"));
  assert.ok(nearbyRoute.includes('export async function POST(request: Request)'));
  assert.ok(nearbyRoute.includes("supabase.rpc('search_marketplace_service_nearby_candidates_v2'"));
  assert.ok(nearbyRoute.includes("'Cache-Control': 'no-store'"));
  assert.ok(!searchRoute.includes('productionAuthProvider'));
  assert.ok(!nearbyRoute.includes('productionAuthProvider'));
});

test('service discovery response keeps stable provider navigation fields', () => {
  assert.ok(responseMapping.includes('provider_type: row.provider_type'));
  assert.ok(responseMapping.includes('provider_id: providerId'));
  assert.ok(responseMapping.includes('service_name: { en:'));
  assert.ok(responseMapping.includes('pricing: {'));
  assert.ok(responseMapping.includes('live_work_mode: workMode'));
  assert.ok(responseMapping.includes('business_shop_state:'));
  assert.ok(responseMapping.includes('distance_band:'));
  assert.ok(responseMapping.includes('nearby_match_mode:'));
});

test('public provider directory reuses the verified server directory instead of duplicating database rules', () => {
  assert.ok(providerRoute.includes('loadPublicProfessionals'));
  assert.ok(providerRoute.includes('loadPublicBusinesses'));
  assert.ok(providerRoute.includes("provider_type: providerType"));
  assert.ok(providerRoute.includes('profile_path:'));
  assert.ok(providerRoute.includes("providerType === 'business' ? 'businesses' : 'professionals'"));
  assert.ok(providerRoute.includes("url.searchParams.get('type')"));
  assert.ok(providerRoute.includes("{ 'Cache-Control': 'no-store' }"));
  assert.ok(!providerRoute.includes('createSupabaseServiceClient'));
  assert.ok(!providerRoute.includes('productionAuthProvider'));
  assert.ok(directorySource.includes('hasMarketplaceDisclosure'));
  assert.ok(directorySource.includes(".eq('verified', true)"));
});

test('public provider contract rejects unknown provider types and fails closed when directory data is unavailable', () => {
  assert.ok(providerRoute.includes("Provider type must be professional, business, or all."));
  assert.ok(providerRoute.includes('{ status: 400'));
  assert.ok(providerRoute.includes('professionals === null || businesses === null'));
  assert.ok(providerRoute.includes("Public provider directory is temporarily unavailable."));
  assert.ok(providerRoute.includes('{ status: 503'));
});

test('mobile marketplace contract stays outside frozen finance and recovery domains', () => {
  const combined = [searchRoute, nearbyRoute, responseMapping, providerRoute].join('\n').toLowerCase();
  for (const forbidden of ['cashfree', 'refund', 'payout', 'settlement', 'reconciliation', 'requirementoccurrencerecoverypanel']) {
    assert.ok(!combined.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
