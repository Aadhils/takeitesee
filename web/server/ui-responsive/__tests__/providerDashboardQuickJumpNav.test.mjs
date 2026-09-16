import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [managerSource, cssSource] = await Promise.all([
  readFile(new URL('components/provider/ProviderDashboardManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardManager.module.css', root), 'utf8'),
]);

test('Provider Dashboard exposes compact in-page quick navigation', () => {
  assert.ok(managerSource.includes('aria-label="Dashboard quick navigation"'));
  assert.ok(managerSource.includes('id="provider-dashboard-overview"'));
  assert.ok(managerSource.includes("href: '#provider-profile'"));
  assert.ok(managerSource.includes("href: '#provider-marketplace-launch'"));
  assert.ok(managerSource.includes("href: '#provider-booking-availability'"));
  assert.ok(managerSource.includes("href: '#provider-service-reach'"));
  assert.ok(managerSource.includes("href: '#provider-booking-inbox'"));
});

test('quick navigation keeps Professional and Business destinations role-aware', () => {
  assert.ok(managerSource.includes("profile.provider_type === 'business'"));
  assert.ok(managerSource.includes("{ href: '/provider/products', label: 'Products', route: true }"));
  assert.ok(managerSource.includes("{ href: '/provider/jobs/applications', label: 'Career', route: true }"));
  assert.ok(managerSource.includes('item.route'));
});

test('quick navigation remains sticky, swipeable, touch safe and keyboard visible', () => {
  assert.ok(cssSource.includes('.jumpNav'));
  assert.ok(cssSource.includes('position: sticky'));
  assert.ok(cssSource.includes('.jumpRail'));
  assert.ok(cssSource.includes('overflow-x: auto'));
  assert.ok(cssSource.includes('scroll-snap-type: x proximity'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('.jumpLink:focus-visible'));
  assert.ok(cssSource.includes('@media (max-width: 780px)'));
});

test('Dashboard anchors reserve space below the sticky navigation without changing data APIs', () => {
  assert.ok(cssSource.includes(':global(#provider-marketplace-launch)'));
  assert.ok(cssSource.includes(':global(#provider-booking-inbox)'));
  assert.ok(cssSource.includes('scroll-margin-top: 148px'));
  assert.ok(managerSource.includes("fetch('/api/provider/profile'"));
  assert.ok(managerSource.includes("fetch('/api/provider/bookings'"));
});
