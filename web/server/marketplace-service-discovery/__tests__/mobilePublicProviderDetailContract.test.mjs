import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [detailRoute, professionalSource, businessSource, directoryRoute] = await Promise.all([
  readFile(new URL('app/api/marketplace/providers/[providerType]/[providerId]/route.ts', root), 'utf8'),
  readFile(new URL('components/detail/ProfessionalPublicProfileContent.tsx', root), 'utf8'),
  readFile(new URL('components/detail/BusinessPublicProfileContent.tsx', root), 'utf8'),
  readFile(new URL('app/api/marketplace/providers/route.ts', root), 'utf8'),
]);

test('provider detail API reuses the same public profile eligibility loaders as web profiles', () => {
  assert.ok(detailRoute.includes('loadPublicProfessional'));
  assert.ok(detailRoute.includes('loadPublicBusiness'));
  assert.ok(professionalSource.includes('export const loadPublicProfessional'));
  assert.ok(businessSource.includes('export const loadPublicBusiness'));
  assert.ok(professionalSource.includes(".eq('verified', true)"));
  assert.ok(businessSource.includes(".eq('verified', true)"));
  assert.ok(!detailRoute.includes('createSupabaseServiceClient'));
  assert.ok(!detailRoute.includes('productionAuthProvider'));
});

test('provider directory and detail contracts share provider type and profile routing semantics', () => {
  assert.ok(directoryRoute.includes("provider_type: providerType"));
  assert.ok(detailRoute.includes('provider_type: providerType'));
  assert.ok(directoryRoute.includes("providerType === 'business' ? 'businesses' : 'professionals'"));
  assert.ok(detailRoute.includes("providerType === 'business' ? 'businesses' : 'professionals'"));
  assert.ok(detailRoute.includes('profile_path:'));
});

test('professional provider detail exposes native profile sections with normalized services', () => {
  assert.ok(detailRoute.includes("publicIdentity('professional', id, provider)"));
  assert.ok(detailRoute.includes('services: services.map(normalizedService)'));
  assert.ok(detailRoute.includes('roles: roles.map'));
  assert.ok(detailRoute.includes('service_bookings_enabled: Boolean(role.service_bookings_enabled)'));
  assert.ok(detailRoute.includes('media,'));
  assert.ok(detailRoute.includes('career,'));
});

test('business provider detail exposes native services and public product summaries', () => {
  assert.ok(detailRoute.includes("publicIdentity('business', id, business)"));
  assert.ok(detailRoute.includes('services: services.map(normalizedService)'));
  assert.ok(detailRoute.includes('products: products.map'));
  assert.ok(detailRoute.includes('stock_mode: product.stock_mode'));
  assert.ok(detailRoute.includes('has_primary_image: Boolean(product.has_primary_image)'));
});

test('provider detail contract validates type, fails closed for unavailable profiles, and disables caching', () => {
  assert.ok(detailRoute.includes("Provider type must be professional or business."));
  assert.ok(detailRoute.includes("Professional provider was not found."));
  assert.ok(detailRoute.includes("Business provider was not found."));
  assert.ok(detailRoute.includes('{ status: 400'));
  assert.ok(detailRoute.includes('{ status: 404'));
  assert.ok(detailRoute.includes("'Cache-Control': 'no-store'"));
});

test('provider detail mobile contract stays outside frozen finance and recovery domains', () => {
  const source = detailRoute.toLowerCase();
  for (const forbidden of ['cashfree', 'refund', 'payout', 'settlement', 'reconciliation', 'requirementoccurrencerecoverypanel']) {
    assert.ok(!source.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
