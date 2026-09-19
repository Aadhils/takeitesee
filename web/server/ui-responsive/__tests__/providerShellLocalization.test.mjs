import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, catalog] = await Promise.all([
  readFile(new URL('components/provider/LiveProviderShell.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

const keys = [...new Set(
  [...source.matchAll(/t\('(provider\.shell\.[^']+)'\)/g)].map((match) => match[1]),
)];

test('Provider shell uses shared localization without inline Tamil branches', () => {
  assert.ok(keys.length >= 20);
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes('tamil ?'));
});

test('Every Provider shell key exists in English and Tamil catalogs', () => {
  for (const key of keys) {
    const occurrences = catalog.split(`'${key}'`).length - 1;
    assert.equal(occurrences, 2, `${key} should exist once in English and once in Tamil`);
  }
});

test('Provider shell preserves role-aware navigation and attention behavior', () => {
  for (const id of ['customer-work', 'services-trust', 'professional-career', 'business-hiring', 'earnings']) {
    assert.ok(source.includes(`id: '${id}'`));
  }
  assert.ok(source.includes("link.href === '/provider/leads' && unreadLeads > 0"));
  assert.ok(source.includes("link.href === '/provider/bookings' && pending > 0"));
  assert.ok(source.includes("link.href === '/provider/messages' && messageUnreadCount > 0"));
  assert.ok(source.includes("link.href === '/provider/orders' && requestedProductOrders > 0"));
  assert.ok(source.includes("link.href === '/notifications' && notificationUnreadCount > 0"));
});

test('Provider shell preserves workspace/public-presence routes', () => {
  assert.ok(source.includes('href="/account#workspaces"'));
  assert.ok(source.includes('href="/provider/public-readiness"'));
  assert.ok(source.includes('href="/account/settings"'));
  assert.ok(source.includes('href="/"'));
  assert.ok(source.includes('/businesses/${encodeURIComponent(provider.id)}'));
  assert.ok(source.includes('/professionals/${encodeURIComponent(provider.id)}'));
});

test('Primary shell copy no longer remains hardcoded', () => {
  const forbidden = [
    'Customer work',
    'Services & trust',
    'Presence & career',
    'Workspace and account tools',
    'View public storefront',
    'Service area not set',
    'Provider quick navigation',
    'More tools',
  ];
  for (const phrase of forbidden) {
    assert.ok(!source.includes(phrase), `localized shell copy should not remain hardcoded: ${phrase}`);
  }
});