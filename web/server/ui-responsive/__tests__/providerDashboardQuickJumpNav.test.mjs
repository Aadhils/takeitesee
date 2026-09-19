import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [managerSource, cssSource] = await Promise.all([
  readFile(new URL('components/provider/ProviderDashboardManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardManager.module.css', root), 'utf8'),
]);

test('Provider Dashboard exposes one compact workspace toolbar with in-page navigation', () => {
  assert.ok(managerSource.includes("aria-label={t('provider.dashboard.workspaceToolbar')}"));
  assert.ok(managerSource.includes('className={styles.workspaceToolbar}'));
  assert.ok(managerSource.includes('className={styles.workspaceIdentity}'));
  assert.ok(managerSource.includes('className={styles.workspaceRail}'));
  assert.ok(managerSource.includes('className={styles.workspaceEdit}'));
  assert.ok(!managerSource.includes('<ProviderHeading'));
  assert.ok(managerSource.includes('id="provider-dashboard-overview"'));
  assert.ok(managerSource.includes("href: '#provider-profile'"));
  assert.ok(managerSource.includes("href: '#provider-marketplace-launch'"));
  assert.ok(managerSource.includes("href: '#provider-booking-availability'"));
  assert.ok(managerSource.includes("href: '#provider-service-reach'"));
  assert.ok(managerSource.includes("href: '#provider-booking-inbox'"));
});

test('quick navigation keeps Professional and Business destinations role-aware', () => {
  assert.ok(managerSource.includes("profile.provider_type === 'business'"));
  assert.ok(managerSource.includes("{ href: '/provider/products', label: t('provider.dashboard.products'), route: true }"));
  assert.ok(managerSource.includes("{ href: '/provider/jobs/applications', label: t('provider.dashboard.career'), route: true }"));
  assert.ok(managerSource.includes('item.route'));
});

test('workspace toolbar remains sticky, swipeable, touch safe and keyboard visible', () => {
  assert.ok(cssSource.includes('.workspaceToolbar'));
  assert.ok(cssSource.includes('position: sticky'));
  assert.ok(cssSource.includes('.workspaceRail'));
  assert.ok(cssSource.includes('overflow-x: auto'));
  assert.ok(cssSource.includes('scroll-snap-type: x proximity'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('.workspaceLink:focus-visible'));
  assert.ok(cssSource.includes('.workspaceEdit:focus-visible'));
  assert.ok(cssSource.includes('@media (max-width: 780px)'));
  assert.ok(cssSource.includes('.workspaceEdit { display: none; }'));
  assert.ok(cssSource.includes('.workspaceIdentity :global(.badge) { display: none; }'));
  assert.ok(!cssSource.includes('.jumpNav'));
});

test('Dashboard anchors reserve space below the sticky toolbar without changing data APIs', () => {
  assert.ok(cssSource.includes(':global(#provider-marketplace-launch)'));
  assert.ok(cssSource.includes(':global(#provider-booking-inbox)'));
  assert.ok(cssSource.includes('scroll-margin-top: 148px'));
  assert.ok(managerSource.includes("fetch('/api/provider/profile'"));
  assert.ok(managerSource.includes("fetch('/api/provider/bookings'"));
});
