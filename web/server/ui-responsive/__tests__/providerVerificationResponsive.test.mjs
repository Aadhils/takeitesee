import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, managerSource, cssSource] = await Promise.all([
  readFile(new URL('app/provider/verification/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderVerificationManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderVerificationResponsive.module.css', root), 'utf8'),
]);

test('Provider Verification route uses responsive wrapper', () => {
  assert.ok(routeSource.includes('ProviderVerificationResponsive.module.css'));
  assert.ok(routeSource.includes('verificationJourney'));
});

test('Provider Verification styles cover phone and tablet layouts', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('max-width: 760px'));
  assert.ok(cssSource.includes('max-width: 560px'));
  assert.ok(cssSource.includes('review-details'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('Verification workflow contracts remain present', () => {
  assert.ok(managerSource.includes('/api/provider/verification'));
  assert.ok(managerSource.includes('/api/provider/verification/documents'));
  assert.ok(managerSource.includes('marketplace_disclosure_complete'));
  assert.ok(managerSource.includes('missing_disclosure_fields'));
  assert.ok(managerSource.includes('provider-verification-documents'));
  assert.ok(managerSource.includes('withdraw'));
});
