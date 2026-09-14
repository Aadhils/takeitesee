import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, managerSource, cssSource] = await Promise.all([
  readFile(new URL('app/provider/handle/page.tsx', root), 'utf8'),
  readFile(new URL('components/identity/IdentityHandleManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderHandleResponsive.module.css', root), 'utf8'),
]);

test('Provider Handle route uses responsive wrapper', () => {
  assert.ok(routeSource.includes('ProviderHandleResponsive.module.css'));
  assert.ok(routeSource.includes('handleJourney'));
  assert.ok(routeSource.includes('IdentityHandleManager context="provider"'));
  assert.ok(routeSource.includes('getProviderSessionOrNull'));
});

test('Provider Handle styles cover phone and tablet layouts', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('font-size: 16px'));
  assert.ok(cssSource.includes('max-width: 760px'));
  assert.ok(cssSource.includes('max-width: 560px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('Provider Handle workflow contracts remain present', () => {
  assert.ok(managerSource.includes('/api/identity-handle?context=${context}'));
  assert.ok(managerSource.includes("method: 'PATCH'"));
  assert.ok(managerSource.includes('public_profile_ready'));
  assert.ok(managerSource.includes('readiness_href'));
  assert.ok(managerSource.includes('https://www.takeitesee.com/@${handle}'));
  assert.ok(managerSource.includes('navigator.clipboard.writeText(publicUrl)'));
  assert.ok(managerSource.includes('previous_handle'));
});
