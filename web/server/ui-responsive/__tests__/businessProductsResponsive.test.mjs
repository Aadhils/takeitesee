import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, managerSource, mediaSource, journeyCss] = await Promise.all([
  readFile(new URL('app/provider/products/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderProductsManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProductPrimaryImageControl.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderProductsResponsive.module.css', root), 'utf8'),
]);

test('Business Products route uses the responsive journey wrapper', () => {
  assert.ok(routeSource.includes('ProviderProductsResponsive.module.css'));
  assert.ok(routeSource.includes('productsJourney'));
  assert.ok(routeSource.includes('ProviderProductsManager'));
});

test('Business Products journey covers phone and tablet ergonomics', () => {
  assert.ok(journeyCss.includes('overflow-x: clip'));
  assert.ok(journeyCss.includes('overflow-wrap: anywhere'));
  assert.ok(journeyCss.includes('min-height: 44px'));
  assert.ok(journeyCss.includes('font-size: 16px'));
  assert.ok(journeyCss.includes('max-width: 760px'));
  assert.ok(journeyCss.includes('max-width: 560px'));
  assert.ok(journeyCss.includes('safe-area-inset-bottom'));
});

test('Business Products data, launch and readiness contracts remain present', () => {
  assert.ok(managerSource.includes("fetch('/api/provider/products'"));
  assert.ok(managerSource.includes("fetch('/api/provider/profile'"));
  assert.ok(managerSource.includes("profilePayload.profile.provider_type !== 'business'"));
  assert.ok(managerSource.includes("method: 'POST'"));
  assert.ok(managerSource.includes("method: 'PATCH'"));
  assert.ok(managerSource.includes("/launch`"));
  assert.ok(managerSource.includes('review_revision'));
  assert.ok(managerSource.includes('marketplace_disclosure_complete'));
  assert.ok(managerSource.includes("readiness.trust_status === 'suspended'"));
  assert.ok(managerSource.includes("readiness.trust_status === 'reverification_required'"));
  assert.ok(managerSource.includes('TakeItEsee payment and Cashfree are still disabled.'));
});

test('Business Products primary image revision contract remains present', () => {
  assert.ok(mediaSource.includes("image/jpeg,image/png,image/webp"));
  assert.ok(mediaSource.includes('6 * 1024 * 1024'));
  assert.ok(mediaSource.includes("method: 'PATCH'"));
  assert.ok(mediaSource.includes("method: 'DELETE'"));
  assert.ok(mediaSource.includes('review_revision'));
});
