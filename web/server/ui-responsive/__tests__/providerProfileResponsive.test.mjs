import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, managerSource, cssSource] = await Promise.all([
  readFile(new URL('app/provider/profile/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderProfileManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderProfileResponsive.module.css', root), 'utf8'),
]);

test('Provider Profile route uses responsive wrapper', () => {
  assert.ok(routeSource.includes('ProviderProfileResponsive.module.css'));
  assert.ok(routeSource.includes('profileJourney'));
});

test('Provider Profile styles cover phone and tablet layouts', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('provider-review-summary'));
  assert.ok(cssSource.includes('provider-profile-grid'));
  assert.ok(cssSource.includes('button-row'));
  assert.ok(cssSource.includes('choice-row'));
  assert.ok(cssSource.includes('choice-input'));
  assert.ok(cssSource.includes('flex: 0 0 18px'));
  assert.ok(cssSource.includes('max-width: 760px'));
  assert.ok(cssSource.includes('max-width: 560px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('Provider Profile and professional role contracts remain present', () => {
  assert.ok(managerSource.includes('/api/provider/profile'));
  assert.ok(managerSource.includes('/api/provider/profile/roles'));
  assert.ok(managerSource.includes('provider_type'));
  assert.ok(managerSource.includes('verifiedVisibility'));
  assert.ok(managerSource.includes('service_bookings_enabled'));
  assert.ok(managerSource.includes('full_time_enabled'));
  assert.ok(managerSource.includes('contract_enabled'));
  assert.ok(managerSource.includes('/provider/setup'));
});

test('Professional role editor surfaces duplicate saves locally and keeps errors near the action', () => {
  assert.ok(managerSource.includes('role.id !== editingRoleId'));
  assert.ok(managerSource.includes('roleCopy.duplicate'));
  assert.ok(managerSource.includes('roleError && !roleEditorOpen'));
  assert.ok(managerSource.includes('aria-live="assertive"'));
});
