import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const paths = {
  theme: 'lib/theme.ts',
  brand: 'components/BrandLogo.tsx',
  nav: 'components/MobileNav.tsx',
  home: 'app/home.tsx',
  login: 'app/login.tsx',
  entry: 'app/index.tsx',
  explore: 'app/explore.tsx',
  requirements: 'app/requirements.tsx',
  account: 'app/account.tsx',
  provider: 'app/provider.tsx',
  providerBookings: 'app/provider-bookings.tsx',
  notifications: 'app/notifications.tsx',
  serviceDetail: 'app/service/[serviceId].tsx',
  directBooking: 'app/book-service/[serviceId].tsx',
};

const entries = await Promise.all(
  Object.entries(paths).map(async ([key, path]) => [key, await readFile(new URL(path, root), 'utf8')]),
);
const source = Object.fromEntries(entries);

test('native theme matches the approved TakeItEsee web brand palette', () => {
  for (const token of [
    "primary: '#6352D9'",
    "primaryStrong: '#2D2D9A'",
    "accent: '#8F7AFF'",
    "ink: '#101A34'",
    "inkMuted: '#5E6983'",
    "border: '#DFE6F2'",
    "secondary: '#F2EFFF'",
  ]) {
    assert.ok(source.theme.includes(token), `missing brand token: ${token}`);
  }
});

test('native brand mark uses the existing official TakeItEsee logo with a resilient fallback', () => {
  assert.ok(source.brand.includes('https://www.takeitesee.com/official-takeitesee-logo.png'));
  assert.ok(source.brand.includes('onError={() => setFailed(true)}'));
  assert.ok(source.brand.includes('TakeItEsee'));
});

test('primary native workspaces surface the shared brand mark', () => {
  for (const key of ['home', 'login', 'entry', 'explore', 'requirements', 'account', 'provider', 'providerBookings', 'notifications']) {
    assert.ok(source[key].includes('<BrandLogo'), `${key} must show the shared brand mark`);
  }
});

test('primary actions and bottom navigation use shared brand theme tokens', () => {
  assert.ok(source.nav.includes('backgroundColor: theme.colors.primary'));
  assert.ok(source.home.includes('backgroundColor: theme.colors.primary'));
  assert.ok(source.explore.includes('backgroundColor: theme.colors.primary'));
  assert.ok(source.requirements.includes('backgroundColor: theme.colors.primary'));
  assert.ok(source.provider.includes('backgroundColor: theme.colors.primary'));
  assert.ok(source.providerBookings.includes('backgroundColor: theme.colors.primary'));
  assert.ok(source.notifications.includes('backgroundColor: theme.colors.primary'));
  assert.ok(source.serviceDetail.includes('backgroundColor: theme.colors.primary'));
  assert.ok(source.directBooking.includes('backgroundColor: theme.colors.primary'));
});

test('real-device polish keeps Home cards readable and Notifications human-friendly', () => {
  assert.ok(!source.home.includes("quickText: { flex: 1"));
  assert.ok(source.notifications.includes('formatNotificationTime(item.created_at)'));
  assert.ok(!source.notifications.includes('{item.created_at}</Text>'));
});

test('Provider UI keeps frozen recurring behavior without exposing implementation jargon', () => {
  assert.ok(source.provider.includes("lead.schedule_pattern !== 'one_time'"));
  assert.ok(source.provider.includes('Recurring proposal actions are available on the web for now.'));
  assert.ok(!source.provider.includes('server-verified provider identity'));
  assert.ok(!source.provider.includes('read-only in native v1'));
});
