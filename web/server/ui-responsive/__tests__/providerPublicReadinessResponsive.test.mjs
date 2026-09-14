import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, managerSource, cssSource] = await Promise.all([
  readFile(new URL('app/provider/public-readiness/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProfessionalPublicReadinessManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderPublicReadinessResponsive.module.css', root), 'utf8'),
]);

test('Provider Public Readiness route uses responsive wrapper', () => {
  assert.ok(routeSource.includes('ProviderPublicReadinessResponsive.module.css'));
  assert.ok(routeSource.includes('readinessJourney'));
  assert.ok(routeSource.includes('getProviderSessionOrNull'));
});

test('Provider Public Readiness styles cover phone and tablet layouts', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('provider-profile-grid'));
  assert.ok(cssSource.includes('provider-review-summary'));
  assert.ok(cssSource.includes('button-row'));
  assert.ok(cssSource.includes('max-width: 760px'));
  assert.ok(cssSource.includes('max-width: 560px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('Public readiness workflow contracts remain present', () => {
  assert.ok(managerSource.includes('/api/provider/profile'));
  assert.ok(managerSource.includes('/api/provider/profile/roles'));
  assert.ok(managerSource.includes('/api/provider/resume'));
  assert.ok(managerSource.includes('marketplace_disclosure_complete'));
  assert.ok(managerSource.includes('trust_status'));
  assert.ok(managerSource.includes('services_paused'));
  assert.ok(managerSource.includes('products_paused'));
  assert.ok(managerSource.includes('/provider/verification'));
  assert.ok(managerSource.includes('/account/support'));
});
