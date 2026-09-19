import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const paths = [
  'components/provider/ProviderDashboardAvailabilityCenter.tsx',
  'components/provider/ProviderDashboardReachCenter.tsx',
  'components/provider/ProviderServiceReachControl.tsx',
  'components/provider/ProviderDashboardBookingInbox.tsx',
  'components/provider/BusinessProductCatalogShortcut.tsx',
  'components/provider/BusinessProductOrderAttention.tsx',
  'components/provider/BusinessShopStatusControl.tsx',
];
const [catalogSource, shellSource, ...childSources] = await Promise.all([
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
  readFile(new URL('components/provider/LiveProviderShell.tsx', root), 'utf8'),
  ...paths.map((path) => readFile(new URL(path, root), 'utf8')),
]);

const combined = childSources.join('\n');
const localizedKeys = [...new Set(
  [...combined.matchAll(/t\('(provider\.(?:availability|reach|bookingInbox|business)\.[^']+)'\)/g)].map((match) => match[1]),
)];

test('Provider Dashboard child modules use shared localization instead of local bilingual copy blocks', () => {
  assert.ok(localizedKeys.length >= 75);
  for (const source of childSources) {
    assert.ok(!source.includes('const tamil'), 'dashboard child module should not define a local tamil flag');
    assert.ok(!source.includes('const copy ='), 'dashboard child module should not define a local bilingual copy object');
  }
});

test('Every migrated Provider Dashboard child key has English and Tamil catalog parity', () => {
  for (const key of localizedKeys) {
    const occurrences = catalogSource.split(`'${key}'`).length - 1;
    assert.equal(occurrences, 2, `${key} should exist once in English and once in Tamil`);
  }
});

test('Availability, reach, booking and Business behavior routes remain unchanged', () => {
  const availability = childSources[0];
  const reachCenter = childSources[1];
  const reachControl = childSources[2];
  const inbox = childSources[3];
  const productShortcut = childSources[4];
  const orderAttention = childSources[5];
  const shopStatus = childSources[6];

  assert.ok(availability.includes("fetch('/api/provider/services'"));
  assert.ok(availability.includes('/availability'));
  assert.ok(availability.includes('href="/provider/schedule"'));

  assert.ok(reachCenter.includes("fetch('/api/provider/services'"));
  assert.ok(reachControl.includes('/reach'));
  assert.ok(reachControl.includes("action: 'save_modes'"));
  assert.ok(reachControl.includes("action: 'set_location'"));
  assert.ok(reachControl.includes("action: 'remove_location'"));

  assert.ok(inbox.includes("fetch('/api/provider/bookings'"));
  assert.ok(inbox.includes('href="/provider/bookings"'));

  assert.ok(productShortcut.includes('href="/provider/products"'));
  assert.ok(orderAttention.includes("fetch('/api/provider/orders'"));
  assert.ok(orderAttention.includes('href="/provider/orders"'));
  assert.ok(shopStatus.includes("fetch('/api/provider/shop-status'"));
  assert.ok(shopStatus.includes("method: 'PUT'"));
});

test('Business Provider shortcut navigation uses the shared translation catalog', () => {
  assert.ok(shellSource.includes("label: t('provider.business.navigation')"));
  assert.ok(shellSource.includes("{ href: '/provider/products', label: t('provider.dashboard.products') }"));
  assert.ok(shellSource.includes("{ href: '/provider/orders', label: t('provider.business.productOrders') }"));
  assert.ok(shellSource.includes("{ href: '/provider/jobs', label: t('provider.dashboard.employerJobs') }"));
});

test('Migrated child surfaces no longer hardcode their primary visible English copy', () => {
  const forbidden = [
    'Control service availability from this Dashboard',
    'How does each service reach the customer?',
    'Service reach & precise location</span>',
    'Customer booking next actions</h2>',
    'Prepare products you plan to sell in your private catalog.',
    'Review latest order</',
    'Closing the shop does not cancel existing bookings or orders.',
  ];
  for (const phrase of forbidden) {
    assert.ok(!combined.includes(phrase), `localized child copy should not remain hardcoded: ${phrase}`);
  }
});
