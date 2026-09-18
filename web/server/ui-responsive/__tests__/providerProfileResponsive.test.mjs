import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, dashboardSource, identitySource, cssSource, profileApiSource] = await Promise.all([
  readFile(new URL('app/provider/profile/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardIdentityCenter.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardIdentityCenter.module.css', root), 'utf8'),
  readFile(new URL('app/api/provider/profile/route.ts', root), 'utf8'),
]);

test('Provider Profile compatibility route returns users to the Dashboard identity center', () => {
  assert.ok(routeSource.includes("redirect('/provider#provider-profile')"));
  assert.ok(!routeSource.includes('ProviderProfileSetupCenter'));
});

test('Provider Dashboard owns Professional and Business profile controls', () => {
  assert.ok(dashboardSource.includes("import ProviderDashboardIdentityCenter"));
  assert.ok(dashboardSource.includes('<ProviderDashboardIdentityCenter onProfileUpdated={load} />'));
  assert.ok(dashboardSource.includes("href=\"/provider#provider-profile\""));
  assert.ok(dashboardSource.includes("profile.provider_type === 'business'"));
  assert.ok(dashboardSource.includes("profile.provider_type === 'professional'"));
  assert.ok(!dashboardSource.includes('Profile readiness\"'));
  assert.ok(!dashboardSource.includes('Open profile'));
});

test('Dashboard identity center preserves profile and Professional role contracts', () => {
  assert.ok(identitySource.includes("fetch('/api/provider/profile'"));
  assert.ok(identitySource.includes("fetch('/api/provider/profile/roles'"));
  assert.ok(identitySource.includes("profile.provider_type === 'professional'"));
  assert.ok(identitySource.includes("profile.provider_type === 'business'"));
  assert.ok(identitySource.includes('service_bookings_enabled'));
  assert.ok(identitySource.includes('full_time_enabled'));
  assert.ok(identitySource.includes('contract_enabled'));
  assert.ok(identitySource.includes('/provider/public-readiness'));
  assert.ok(identitySource.includes('/provider/setup'));
});

test('Dashboard role editing remains progressive and mobile-friendly', () => {
  assert.ok(identitySource.includes('className={styles.managementDisclosure}'));
  assert.ok(identitySource.includes('<details className={styles.more}>'));
  assert.ok(identitySource.includes('role.id !== editingRoleId'));
  assert.ok(identitySource.includes('aria-live="assertive"'));
  assert.ok(cssSource.includes('grid-auto-flow: column'));
  assert.ok(cssSource.includes('scroll-snap-type: x proximity'));
  assert.ok(cssSource.includes('grid-auto-columns: minmax(245px'));
  assert.ok(cssSource.includes('flex: 0 0 18px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
  assert.ok(cssSource.includes('.managementSummary'));
  assert.ok(cssSource.includes('min-height: 58px'));
  assert.ok(cssSource.includes('.managementBody'));
  assert.ok(cssSource.includes('.launchCompactBody'));
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
