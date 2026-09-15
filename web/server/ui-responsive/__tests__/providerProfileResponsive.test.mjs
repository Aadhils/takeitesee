import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, centerSource, cssSource, profileApiSource] = await Promise.all([
  readFile(new URL('app/provider/profile/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderProfileSetupCenter.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderProfileSetupCenter.module.css', root), 'utf8'),
  readFile(new URL('app/api/provider/profile/route.ts', root), 'utf8'),
]);

test('Provider Profile route uses the smart setup center', () => {
  assert.ok(routeSource.includes('ProviderProfileSetupCenter'));
  assert.ok(!routeSource.includes('ProviderProfileManager'));
});

test('Provider Profile setup center keeps the core profile and role contracts', () => {
  assert.ok(centerSource.includes('/api/provider/profile'));
  assert.ok(centerSource.includes('/api/provider/profile/roles'));
  assert.ok(centerSource.includes('provider_type'));
  assert.ok(centerSource.includes('service_bookings_enabled'));
  assert.ok(centerSource.includes('full_time_enabled'));
  assert.ok(centerSource.includes('contract_enabled'));
  assert.ok(centerSource.includes('/provider/setup'));
});

test('Provider Profile setup is progressive instead of exposing every role option at once', () => {
  assert.ok(centerSource.includes('Profile setup center'));
  assert.ok(centerSource.includes('Quick role setup'));
  assert.ok(centerSource.includes('<details className={styles.moreOptions}>'));
  assert.ok(centerSource.includes('role.id !== editingRoleId'));
  assert.ok(centerSource.includes('aria-live="assertive"'));
});

test('Provider Profile styles compact the journey across phone and tablet layouts', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('grid-template-columns: repeat(3'));
  assert.ok(cssSource.includes('grid-auto-flow: column'));
  assert.ok(cssSource.includes('scroll-snap-type: inline mandatory'));
  assert.ok(cssSource.includes('grid-auto-columns: minmax(82%'));
  assert.ok(cssSource.includes('flex: 0 0 18px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('Provider Profile mutation uses the owner-scoped RPC instead of direct table writes', () => {
  const patchSource = profileApiSource.split('export async function PATCH')[1] ?? '';
  assert.ok(patchSource.includes("rpc('update_provider_profile'"));
  assert.ok(patchSource.includes('requested_display_name: input.displayName'));
  assert.ok(patchSource.includes('requested_description: input.description'));
  assert.ok(patchSource.includes('requested_location: input.location'));
  assert.ok(!patchSource.includes("from('professional_profiles')"));
  assert.ok(!patchSource.includes("from('businesses')"));
});
